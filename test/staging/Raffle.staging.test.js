const { getNamedAccounts, deployments, ethers, network} = require("hardhat");
const {assert, expect} = require("chai");
const {developmentChains, networkConfig } = require("../../helper-hardhat-config");

developmentChains.includes(network.name)? describe.skip :
describe("Raffle unit Tests", ()=>{
    let raffle; // contracts variables
    let deployer;
    let interval;
    // const chainId = network.config.chainId;
    let EnteranceFee;
    beforeEach(async()=>{

        deployer=  (await getNamedAccounts()).deployer; // getting deployer
        // await deployments.fixture(["all"]) // deploying the contracts
    
        raffle = await ethers.getContract("Raffle", deployer);  // deployer is used to make transaction
        // vrfCoordinatorV2 = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
        EnteranceFee = await raffle.getEnteranceFee()

        interval = await raffle.getInterval();
    })
    
    describe("fulfillRandomWords", ()=>{
        it("works with live chainlink keepers and VRF, we get a random winner", async()=>{
            const startingTimeStamp = await raffle.getlatestTimeStamp();
            const accounts = await ethers.getSigners();
            
            await new Promise(async(resolve, reject)=>{
                // Listener do something when winner is picked.....
                raffle.once("WinnerPicked", async ()=>{
                  console.log("winner is picked!")
                  console.log("Found the event!");
                  try {
                      const recentWinner = await raffle.getRecentWinner();
                      const rafflestate = await raffle.raffleStateFunc();
                      const endingTimestamp = await raffle.getlatestTimeStamp();
                      const NumOfPalyers = await raffle.getNumOfPlayers();
                      const winnerEndingBal = await accounts[0].getBalance();
                    console.log(`Winner is account:${recentWinner}`);

                    await expect(raffle. getPlayer(0)).to.be.reverted;
                    assert.equal(recentWinner,accounts[0].address);
                    assert.equal(rafflestate.toString(),"0");
                    assert((endingTimestamp-startingTimeStamp)>interval);
                    assert(winnerEndingBal.toString(), winnerstartingBal.add(EnteranceFee).toString())
                    resolve()
                  }catch(e){
                      reject(e)
                  }
                })
                
                await raffle.enterRaffle({value: EnteranceFee});
                const winnerstartingBal = await accounts[0].getBalance();
           
        })
       
        })
    })
})