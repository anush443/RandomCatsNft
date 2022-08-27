// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "hardhat/console.sol";

error RandomCatsNft__NotEnoughEthSent();
error RandomCatsNft__RangeOutOfBounds();
error RandomCatsNft__TokenUriAlreadyInitialized();

contract RandomCatsNft is ERC721URIStorage, VRFConsumerBaseV2, Ownable {
    /*type declaartions */
    enum CatType {
        Molly_Cat,
        Grumpy_Cat,
        Feral_Cat
    }
    uint256 private immutable i_mintFee;

    /*vrf variable */
    VRFCoordinatorV2Interface private immutable i_vrfcoordinator;
    uint64 private immutable i_subscriptionId;
    bytes32 private immutable i_gasLane;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    /*Contract Varaiable*/
    uint256 private s_tokenCounter;
    mapping(uint256 => address) public s_requestIdToSender;
    uint256 internal constant MAX_CHANCE = 100;
    string[] internal s_catTokenUris;
    bool private s_initialized;

    /*events*/
    event NftRequested(uint256 indexed requestId, address indexed requester);
    event NftMinted(CatType catType, address minter);

    constructor(
        address vrfcoordinator,
        uint64 subscriptionId,
        bytes32 gasLane, // keyHash
        uint32 callbackGasLimit,
        uint256 mintFee,
        string[3] memory catTokenUris
    ) VRFConsumerBaseV2(vrfcoordinator) ERC721("Random Cats Nft V2", "RCN") {
        i_vrfcoordinator = VRFCoordinatorV2Interface(vrfcoordinator);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_mintFee = mintFee;
        i_callbackGasLimit = callbackGasLimit;
        s_tokenCounter = 0;
        _intializeTokenUri(catTokenUris);
    }

    function requestNft() public payable returns (uint256 requestId) {
        if (msg.value < i_mintFee) {
            revert RandomCatsNft__NotEnoughEthSent();
        }
        requestId = i_vrfcoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        s_requestIdToSender[requestId] = msg.sender;
        emit NftRequested(requestId, msg.sender);
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        address catOwner = s_requestIdToSender[requestId];
        uint256 newItemId = s_tokenCounter;
        s_tokenCounter = s_tokenCounter + 1;
        uint256 moddedRng = randomWords[0] % MAX_CHANCE;
        CatType catType = getBreedFromModdedRng(moddedRng);
        _safeMint(catOwner, newItemId);
        _setTokenURI(newItemId, s_catTokenUris[uint256(catType)]);
        emit NftMinted(catType, catOwner);
    }

    function getMaxChanceArray() public pure returns (uint256[3] memory) {
        return [10, 30, MAX_CHANCE];
    }

    function getBreedFromModdedRng(uint256 moddedRng) public pure returns (CatType) {
        uint256 cumulativeSum = 0;
        uint256[3] memory chanceArray = getMaxChanceArray();
        for (uint256 i = 0; i < chanceArray.length; i++) {
            if (moddedRng >= cumulativeSum && moddedRng < chanceArray[i]) {
                return CatType(i);
            }
            cumulativeSum = cumulativeSum + chanceArray[i];
        }
        revert RandomCatsNft__RangeOutOfBounds();
    }

    function _intializeTokenUri(string[3] memory catTokenUri) private {
        if (s_initialized) {
            revert RandomCatsNft__TokenUriAlreadyInitialized();
        }
        s_catTokenUris = catTokenUri;
        s_initialized = true;
    }

    function getMintFee() public view returns (uint256) {
        return i_mintFee;
    }

    function getCatTokenUris(uint256 index) public view returns (string memory) {
        return s_catTokenUris[index];
    }

    function getInitialized() public view returns (bool) {
        return s_initialized;
    }

    function getTokenCounter() public view returns (uint256) {
        return s_tokenCounter;
    }

    function tokenURIs(uint256 index) public view returns (string memory) {
        return s_catTokenUris[index];
    }
}
