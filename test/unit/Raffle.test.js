const { getNamedAccounts, deployments, ethers, network} = require("hardhat");
const {assert, expect} = require("chai");
const {developmentChains, networkConfig } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)? describe.skip :
describe("Raffle unit Tests", ()=>{
    let raffle, vrfCoordinatorV2; // contracts variables
    let deployer;
    let interval;
    const chainId = network.config.chainId;
    let EnteranceFee;
    beforeEach(async()=>{

        deployer=  (await getNamedAccounts()).deployer; // getting deployer
        await deployments.fixture(["all"]) // deploying the contracts
    
        raffle = await ethers.getContract("Raffle", deployer);  // deployer is used to make transaction
        vrfCoordinatorV2 = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
        EnteranceFee = await raffle.getEnteranceFee()

        interval = await raffle.getInterval();
    })
    
    // testing constructor..........
    describe("constructor", ()=>{
         it("Intializes raffle correctly", async()=>{
            const raffleState = await raffle.raffleStateFunc();
            const _interval = await raffle.getInterval();
            assert.equal(raffleState.toString(), "0");
            assert.equal(_interval.toString(), networkConfig[chainId]["keepersUpdateInterval"]);
         })
    })

    describe("enterRaffle", ()=>{
        it("it should revert when we do not pay enough", async()=>{
           await expect(raffle.enterRaffle()).to.be.reverted;
        })
        it("should enter player in array", async()=>{
            await raffle.enterRaffle({value: EnteranceFee});
            const getPlayer = await raffle.getPlayer(0);
            const getLotteryBalance = await raffle.getLotteryBalance(); 
            assert.equal(getPlayer, deployer);
            assert.equal(getLotteryBalance.toString(), EnteranceFee);
        })
        it("should emit event on enter", async ()=>{
            await expect(raffle.enterRaffle({value: EnteranceFee})).to.emit(raffle, "RafleEnter");
        })
        it("should not allow enter in raffle when raffle state calculating", async()=>{
            await raffle.enterRaffle({value: EnteranceFee});
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]); // increase blockchain time
            await network.provider.request({ method: "evm_mine", params: [] }) // empty array[] cause we want to mine only one block

            await raffle.performUpkeep([]); // [] empty calldata
            await expect(raffle.enterRaffle({value: EnteranceFee})).to.be.reverted;
        })
    })

    describe("checkUpkeep", ()=>{
        it("should return false if people haven't sent any ETH", async()=>{
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
            await network.provider.request({ method: "evm_mine", params: [] })

            const {upkeepNeeded} = await raffle.callStatic.checkUpkeep([]);
            assert(!upkeepNeeded);
        })
        it("return false if raffle is in calculating state", async()=>{
            await raffle.enterRaffle({value: EnteranceFee});
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]); // increase blockchain time
            await network.provider.request({ method: "evm_mine", params: [] })
            await raffle.performUpkeep([]);
            const raffleState = await raffle.raffleStateFunc();
            const {upkeepNeeded} = await raffle.callStatic.checkUpkeep([]);
            assert.equal(raffleState.toString(), "1");
            assert.equal(upkeepNeeded, false);

        })

        it("should return false if enough time hasn't pass", async()=>{
            await raffle.enterRaffle({value: EnteranceFee});
            await network.provider.send("evm_increaseTime", [interval.toNumber() - 10]); // increase blockchain time
            await network.provider.request({ method: "evm_mine", params: [] });
            const {upkeepNeeded} = await raffle.callStatic.checkUpkeep([]);
            assert(!upkeepNeeded);
        })

        it("should return true if enough time is pass, enough eth is payed, state is open", async()=>{
            await raffle.enterRaffle({value: EnteranceFee});
            await network.provider.send("evm_increaseTime", [interval.toNumber() +1]); // increase blockchain time
            await network.provider.request({ method: "evm_mine", params: [] });
            const {upkeepNeeded} = await raffle.callStatic.checkUpkeep([]);
            assert(upkeepNeeded);
        })
    })

    describe("performUpkeep", ()=>{

        it("should run only when checkUpkeep is true", async()=>{
            await raffle.enterRaffle({value: EnteranceFee});
            await network.provider.send("evm_increaseTime", [interval.toNumber() +1]); // increase blockchain time
            await network.provider.request({ method: "evm_mine", params: [] });
            const tx = await raffle.performUpkeep([]);
            assert(tx);
        })

        it("should reverts if checkUpkeep is false", async()=>{
            await expect(raffle.performUpkeep([])).to.be.reverted;
        })

        it("should make raffle state calculating and call vrf coradinator", async()=>{
            await raffle.enterRaffle({value: EnteranceFee});
            await network.provider.send("evm_increaseTime", [interval.toNumber() +1]); // increase blockchain time
            await network.provider.request({ method: "evm_mine", params: [] });
            const txResponse = await raffle.performUpkeep([]);
            const txReceipt = await txResponse.wait(1);
            const requestId = await txReceipt.events[1].args.requestId;
            const raffleState = await raffle.raffleStateFunc();
            assert.equal(raffleState.toString(), "1");
            assert(requestId.toString>"0");
        })
        
        it("should emit event", async()=>{
            await raffle.enterRaffle({value: EnteranceFee});
            await network.provider.send("evm_increaseTime", [interval.toNumber() +1]); // increase blockchain time
            await network.provider.request({ method: "evm_mine", params: [] });
            await expect(raffle.performUpkeep([])).to.emit(raffle, "RequestedRaffleWinner");
        })

    })

    describe("fulfillRandomWords", ()=>{
        beforeEach(async()=>{
            await raffle.enterRaffle({value: EnteranceFee});
            await network.provider.send("evm_increaseTime", [interval.toNumber() +1]); // increase blockchain time
            await network.provider.request({ method: "evm_mine", params: [] });
        })
        it("can be only be called after performUpkeep", async()=>{
            await expect(vrfCoordinatorV2.fulfillRandomWords(0, raffle.address)).to.be.reverted;
            await expect(vrfCoordinatorV2.fulfillRandomWords(1, raffle.address)).to.be.reverted;
        })

        it("picks a winner, resets lottery and sends money", async()=>{
            // entering additional players......
            const additionalAccounts = 3;
            const startingAccIndex = 1; // deployer =0
            const accounts = await ethers.getSigners();
            for(let i= startingAccIndex; i<additionalAccounts+1; i++){
                const accountConnectedRaffle = raffle.connect(accounts[i]);
                await accountConnectedRaffle.enterRaffle({value: EnteranceFee});
            }
            const startingTimeStamp = await raffle.getlatestTimeStamp();
            console.log(startingTimeStamp.toString());

            // performUpkkepp (mock being chainlink keepers)
            // fullfillRandimWords (mock being chainlink VRF)
            // we will have to wait for the fullfillRandomwords to be called
            await new Promise(async(resolve, reject)=>{
                // Listener do something when winner is picked.....
                raffle.once("WinnerPicked", async ()=>{
                  console.log("Found the event!");
                  try {
                      const recentWinner = await raffle.getRecentWinner();
                      const rafflestate = await raffle.raffleStateFunc();
                      const endingTimestamp = await raffle.getlatestTimeStamp();
                      const NumOfPalyers = await raffle.getNumOfPlayers();
                      const winnerEndingBal = await accounts[1].getBalance();
                    console.log(`Winner is account:${recentWinner}`);
                    console.log(accounts[0].address);
                    console.log(accounts[1].address);
                    console.log(accounts[2].address);
                    console.log(accounts[3].address);

                    assert.equal(NumOfPalyers.toString(), "0");
                    assert.equal(rafflestate.toString(),"0");
                    assert((endingTimestamp-startingTimeStamp)>interval);
                    assert(winnerEndingBal.toString(), winnerStartingBal.mul(additionalAccounts).add(EnteranceFee).toString())
                  }catch(e){
                      reject(e)
                  }
                  resolve()
                })
                // Setting up the listener
                // below, we will fire the event, and the listener will pick it up and resolve
                const tx = await raffle.performUpkeep([]);
                const txReceipt = await tx.wait(1);
                const winnerStartingBal = await accounts[1].getBalance();
                await vrfCoordinatorV2.fulfillRandomWords(txReceipt.events[1].args.requestId, raffle.address);
            })
        })
    })

})