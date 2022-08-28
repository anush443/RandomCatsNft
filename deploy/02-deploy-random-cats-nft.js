const { getNamedAccounts, deployments, network, run } = require("hardhat")
const {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
} = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")
const { storeImages, storeTokenUriMetadata } = require("../utils/uploadToPinata")

const imagesFilePath = "./images/randomNft"
const FUND_AMOUNT = "1000000000000000000000"

let tokenUris = [
    "ipfs://QmT93yF13iVGVmtWJNWyWJNFujFwGntVVDydGcyRVw1TD1",
    "ipfs://QmQdvWVpeyNzio5p9i3jhr8AaSMcJK7FPr99ZbdhtRniY6",
    "ipfs://QmceMnE3tAQGfZT5eS539offcqF2aGHv4wA9RZJvJmtTWJ",
]

const metadataTemplate = {
    name: "",
    description: "",
    image: "",
    attributes: [
        {
            trait_type: "Cuteness",
            value: 100,
        },
    ],
}

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoordinatorV2Address, subscriptionId

    if (process.env.UPLOAD_TO_PINATA == "true") {
        tokenUris = await handleTokenUris()
    }

    if (chainId == 31337) {
        // create VRFV2 Subscription
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait()
        subscriptionId = transactionReceipt.events[0].args.subId
        // Fund the subscription
        // Our mock makes it so we don't actually have to worry about sending fund
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }

    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS

    log("----------------------------------------------------")

    const arguments = [
        vrfCoordinatorV2Address,
        subscriptionId,
        networkConfig[chainId]["gasLane"],
        networkConfig[chainId]["callbackGasLimit"],
        networkConfig[chainId]["mintFee"],
        tokenUris,
    ]

    console.log(arguments)
    const randomCatsNft = await deploy("RandomCatsNft", {
        from: deployer,
        args: arguments,
        log: true,
        waitConfirmations: waitBlockConfirmations,
    })

    // Verify the deployment
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...")
        await verify(randomCatsNft.address, arguments)
    }
}

const handleTokenUris = async () => {
    let tokenUris = []

    const { responses: imageUploadRespones, files } = await storeImages(imagesFilePath)
    for (imageUploadResponesIndex in imageUploadRespones) {
        let tokenUriMetadata = { ...metadataTemplate }
        tokenUriMetadata.name = files[imageUploadResponesIndex].replace(".png", "")
        switch (tokenUriMetadata.name) {
            case "molly-cat":
                tokenUriMetadata.description = `${tokenUriMetadata.name} says hello`
                tokenUriMetadata.attributes[0].trait_type = "Super Cute and Rare"
                tokenUriMetadata.attributes[0].value = 100
                break

            case "grumpy-cat":
                tokenUriMetadata.description = `${tokenUriMetadata.name} says arrr`
                tokenUriMetadata.attributes[0].trait_type = "Angry"
                tokenUriMetadata.attributes[0].value = 30
                break
            case "feral-cat":
                tokenUriMetadata.description = `${tokenUriMetadata.name} says feed me`
                tokenUriMetadata.attributes[0].trait_type = "Hungry"
                tokenUriMetadata.attributes[0].value = 10
        }

        tokenUriMetadata.image = `ipfs://${imageUploadRespones[imageUploadResponesIndex].IpfsHash}`
        console.log(tokenUriMetadata)
        console.log(`Uploading ${tokenUriMetadata.name} matadatato pinata`)
        const metadataUploadResponse = await storeTokenUriMetadata(tokenUriMetadata)
        tokenUris.push(`ipfs://${metadataUploadResponse.IpfsHash}`)
    }
    console.log("Token URIs uploaded! They are:")
    console.log(tokenUris)
    return tokenUris
}

module.exports.tags = ["all", "RandomCatsNft", "main"]
