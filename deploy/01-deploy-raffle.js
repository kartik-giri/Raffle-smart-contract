const {network, ethers} = require("hardhat")
const {verify} = require("../utils/verify")
const { networkConfig,developmentChains,VERIFICATION_BLOCK_CONFIRMATIONS,} = require("../helper-hardhat-config.js");
const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("30");

// deploying script
module.exports = async({getNamedAccounts, deployments})=>{
 const {deploy, log} = deployments;
 const {deployer} = await getNamedAccounts();
 const chainId = network.config.chainId;
 
 let vrfCoordinatorV2Address, subscriptionId
 
 if( developmentChains.includes(network.name)){
     const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock"); // to get recent deployement
     vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
     const transactionResponse = await vrfCoordinatorV2Mock.createSubscription();
     const transactionReceipt = await transactionResponse.wait(1)// wait for 1 block confirmation
     subscriptionId = transactionReceipt.events[0].args.subId; // getting sub id from createSubscrupition function event emit.
     //Fund the subscription
     // Usually we need the link token on a real network
     await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);
    }
    else{
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
        subscriptionId = networkConfig[chainId]["subscriptionId"];
    }
    
const raffleEntranceFee = networkConfig[chainId]["raffleEntranceFee"];
const gasLane = networkConfig[chainId]["gasLane"];
const  callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
const  keepersUpdateInterval = networkConfig[chainId]["keepersUpdateInterval"];

// deploying contract
const raffle = await deploy("Raffle",{
    from: deployer,
    args:[
        vrfCoordinatorV2Address,
        raffleEntranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        keepersUpdateInterval
    ],
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1
 })
 log(`raffle Address is ${raffle.address}`)
 log(`subscription id is :${subscriptionId}`)

 if(developmentChains.includes(network.name)){
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
    await vrfCoordinatorV2Mock.addConsumer(subscriptionId.toNumber(), raffle.address)
    log("adding consumer...")
    log("Consumer added!")
}

 if(!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY){
    log("verifying...");
    await verify(raffle.address, [
        vrfCoordinatorV2Address,
        raffleEntranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        keepersUpdateInterval
    ] )
    
 }
}

module.exports.tags = ["all", "raffle"]