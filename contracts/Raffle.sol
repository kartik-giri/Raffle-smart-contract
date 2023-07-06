// Lottery Contract

// Enter the lottery (paying some amount)
// Pick a random winner (verifiable random)
// Winner to be selected every X minutes -> completely automated

// Chainlink Oracle => Randomness, Automated Execution (Chainlink Keepers)

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
// import "@chainlink/contracts/src/v0.8/ConfirmedOwner.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol"; // chainlink keeper contract

error Raffle_NotEnoughEthEnters();
error Raffle_TransferFailed();
error Raffle_RaffleStateNotOpen();
error Raffle__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);

/**@title A sample Raffle Contract
 * @author Kartik Giri
 * @notice This contract is for creating a sample raffle contract
 * @dev This implements the Chainlink VRF Version 2
 */

contract Raffle is VRFConsumerBaseV2, AutomationCompatibleInterface{
    // Type declaration
    enum RaffleState{OPEN, CALCULATING} // UINT256 WHERE OPEN=0 AND CALCULATING =1

    // State variables
    uint256 private immutable i_enteranceFee;
    address payable[] private s_players;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator; 
    bytes32 private immutable i_gaslane;
    uint64 private immutable i_subscriptionId;
    uint16 private constant REQUEST_CONFIRMATION = 3;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 1;

    // Lottery variables
    address private s_recentWinner;
    RaffleState private s_rafflestate;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;

    // Events
    event RafleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId); // use to emit request id
    event WinnerPicked(address indexed winner);
    
    // Modifier for Raffle_NotEnoughEthEntered
    modifier NotEnoughEthEnters(){
        if(msg.value < i_enteranceFee){
            revert Raffle_NotEnoughEthEnters();
        }
        _;
    }

    modifier RaffleStateNotOpen(){
        if(s_rafflestate != RaffleState.OPEN){
            revert Raffle_RaffleStateNotOpen();
        }
        _;
    }
    
    // Constructor
    // vrfCoordinator is the address of contract which gives us random number
    constructor( address vrfCoordinatorV2, uint256 enteranceFee, bytes32 gaslane, uint64 subscriptionId, uint32 callbackGasLimit, uint256 interval) VRFConsumerBaseV2(vrfCoordinatorV2){
        i_enteranceFee = enteranceFee;
        i_vrfCoordinator =  VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gaslane = gaslane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_rafflestate = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    } 
    
    // functions
    function enterRaffle()  public payable NotEnoughEthEnters RaffleStateNotOpen{
      s_players.push(payable(msg.sender));
      emit RafleEnter(msg.sender);
    }

     /**
     * @dev This is the function that the Chainlink Keeper nodes call
     * they look for `upkeepNeeded` to return True.
     * the following should be true for this to return true:
     * 1. The time interval has passed between raffle runs.
     * 2. The lottery is open.
     * 3. The contract has ETH.
     * 4. Implicity, your subscription is funded with LINK.
     */
     // checks if upkeep is needed
    function checkUpkeep( bytes memory /* checkData */)  public view override returns( bool upkeepNeeded, bytes memory /* performData */){
     bool isOpen = (RaffleState.OPEN == s_rafflestate);
     bool timestamp = ((block.timestamp - s_lastTimeStamp)> i_interval);
     bool hasPlayers = (s_players.length > 0);
     bool hasBalance = (address(this).balance > 0);

    upkeepNeeded =(isOpen && timestamp && hasPlayers && hasBalance); // since we have define the type of upkeepNeeded in retruns so their is no need redeclare it here and it will automatically get returned.
    }

    function performUpkeep( bytes calldata /* performData */) external override{
     // Request the Random Number
     // Once we get , do something with it
     // Chainlink VRF is 2 transaction process
        
        (bool  upkeepNeeded, ) = checkUpkeep("");
         if (!upkeepNeeded) {
            revert Raffle__UpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_rafflestate)
            );
        }
        
        s_rafflestate = RaffleState.CALCULATING;

        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gaslane, //keyhash
            i_subscriptionId,
            REQUEST_CONFIRMATION,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit RequestedRaffleWinner(requestId);
    }

    // To select winner with random number....
    /*requestId cause we are not using in function but we need it to fullfill the function*/
    function fulfillRandomWords(uint256, /*requestId */ uint256[] memory randomWords) internal override{
         uint256 indexOfWinner = randomWords[0] % s_players.length;
         address payable recenctWinner = s_players[indexOfWinner];
         s_recentWinner = recenctWinner;
         
        s_players = new address payable[](0);
        s_lastTimeStamp = block.timestamp;

         (bool success, ) = recenctWinner.call{value: address(this).balance}("");
         if(! success){
            revert Raffle_TransferFailed();
         }
         s_rafflestate = RaffleState.OPEN;
         emit WinnerPicked(recenctWinner);
    }
 
    // View / Pure functions
    function getEnteranceFee() public view returns(uint256){
        return i_enteranceFee;
    }

    function getPlayer(uint256 index) public view returns(address){
        return s_players[index];
    }

    function getRecentWinner() public view returns(address){
        return s_recentWinner;
    }

    function raffleStateFunc() public view returns(RaffleState){
        return s_rafflestate;
    }

    function getNumWords() public pure returns(uint256){
        return NUM_WORDS;
    }

    function getNumOfPlayers() public view returns(uint256){
        return s_players.length;
    }

    function getlatestTimeStamp() public view returns(uint256){
        return s_lastTimeStamp;
    }

     function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATION;
    }

    function getInterval() public view returns(uint256){
        return i_interval;
    }

    function  getLotteryBalance() public view returns(uint256){
        return address(this).balance;
    }
}

