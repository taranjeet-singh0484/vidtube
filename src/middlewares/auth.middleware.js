import jwt from "jsonwebtoken"; 
import {User} from "../models/user.models.js"; 
import {ApiError} from "../utils/apiError.js"; 
import {asyncHandler} from "../utils/asynHandler.js"; 

export const verifyJWT = asyncHandler(async(req, _, next)=>{

    const token  = req.cookies.accessToken || req.header("Authorization").replace("Bearer ","")

    if(!token)
    {
        throw new ApiError("Unauthorized", 401); 
    }
    
    try {
        const decodedToken = jwt.verify(token , process.env.ACCESS_TOKEN_SECRET); 
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
        
        if(!user)
            {
            throw new ApiError("Unauthorized", 401);            
        }

        req.user = user ; 

        next()

    } catch (error) {
        
        throw new ApiError(error?.message || "Invalid Access Token" , 401); 

    }

})