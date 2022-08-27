const fs = require("fs")
const path = require("path")
const pinataSDK = require("@pinata/sdk")
require("dotenv").config()

const pinataApikey = process.env.PINATA_API_KEY
const pinataApiSecret = process.env.PINATA_SECRET
const pinata = pinataSDK(pinataApikey, pinataApiSecret)

const storeImages = async (imagesFilePath) => {
    let responses = []
    const imagesFileFullPath = path.resolve(imagesFilePath)
    const files = fs.readdirSync(imagesFileFullPath)

    for (filesIndex in files) {
        const readableFileStream = fs.createReadStream(`${imagesFileFullPath}/${files[filesIndex]}`)
        try {
            console.log(`Uploading ${files[filesIndex]} to pinata`)
            const response = await pinata.pinFileToIPFS(readableFileStream)
            responses.push(response)
        } catch (error) {
            console.log(error)
        }
    }
    return { responses, files }
}

const storeTokenUriMetadata = async (metadata) => {
    try {
        const response = await pinata.pinJSONToIPFS(metadata)
        return response
    } catch (error) {
        console.log(error)
    }
    return null
}
module.exports = { storeImages, storeTokenUriMetadata }
