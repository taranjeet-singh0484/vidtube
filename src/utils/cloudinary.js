import { v2 as cloudinary } from "cloudinary";
import fs from "fs"; 
import dotenv from "dotenv";

dotenv.config()

// cloudinary configurations 
cloudinary.config({cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_CLOUD_API_KEY,
  api_secret: process.env.CLOUDINARY_CLOUD_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath)=> {
    try {
        if(!localFilePath)  throw new Error("No file path provided");
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type : "auto"
        })

        console.log("File has been uploaded successfully, File Src : "+response.url)
        // once the file uploaded it should be deleted from the server
        fs.unlinkSync(localFilePath);
        return response

    } catch (error) {
         console.error("Cloudinary upload error:", error);
        throw error;
    }
}

const deleteFromCloudinary = async (publicId, resourceType ="image") =>
{
    try {
        let result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
            invalidate: true                //clear cached URLs/CDN
        });
        
        console.log("Deleting from cloudinary", publicId ,"=>", result ); 
    } catch (error) {
        console.log("Error in deleting from cloudinary !!" , error); 
        throw error;
    }
};

export {uploadOnCloudinary , deleteFromCloudinary}