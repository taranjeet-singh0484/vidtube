import { asyncHandler } from "../utils/asynHandler.js";
import mongoose from "mongoose";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.models.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import { compare, genSalt } from "bcrypt";
// import { access } from "fs";
// import { subscribe } from "diagnostics_channel";
// import { error } from "console";
// import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";
// import { lookup } from "dns";
// import { pipeline } from "stream";
// import dotenv from "dotenv";

// dotenv.config()

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;

    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    new ApiError(
      "Something went wrong while generating the access and refresh token ",
      500
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  console.log("req.body:", req.body); // 👈 check what text fields you are receiving
  console.log("req.files:", req.files); // 👈 check uploaded files (avatar, coverImage, etc.)

  // ✅ Safe destructuring with fallback
  const {
    fullName = "",
    email = "",
    username = "",
    password = "",
  } = req.body || {};

  // ✅ Validate required fields
  if (
    [fullName, email, username, password].some((field) => field.trim() === "")
  ) {
    throw new ApiError("All fields are required !", 400);
  }

  // ✅ Check if user exists
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError("Username or Email already exists !", 409);
  }

  // ✅ Handle avatar and cover image
  console.warn(req.files);
  const avatarLocalPath = req.files?.avatar?.[0]?.path?.replace(/\\/g, "/");
  const coverImagePath = req.files?.coverImage?.[0]?.path?.replace(/\\/g, "/");

  console.log("Avatar local path:", avatarLocalPath);

  if (!avatarLocalPath) {
    throw new ApiError("Avatar file is missing", 400);
  }

  // const avatar = await uploadOnCloudinary(avatarLocalPath);

  // let coverImage = "";
  // if (coverImagePath) {
  //   coverImage = await uploadOnCloudinary(coverImagePath);
  // }

  let avatar;
  try {
    avatar = await uploadOnCloudinary(avatarLocalPath);
    console.log("uploaded avatar!!", avatar);
  } catch (error) {
    console.log("Error uploading avatar", error);
    throw new ApiError("Failed to  upload avatar", 500);
  }

  let coverImage;
  try {
    coverImage = await uploadOnCloudinary(coverImagePath);
    console.log("uploaded cover image!!", coverImage);
  } catch (error) {
    console.log("Error uploading cover image", error);
    throw new ApiError("Failed to  upload cover image", 500);
  }

  // ✅ Create user
  try {
    const user = await User.create({
      fullName,
      email,
      password,
      avatar: avatar?.url || "",
      coverImage: coverImage?.url || "",
      username: username.toLowerCase(),
    });

    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );

    if (!createdUser) {
      throw new ApiError("Something went wrong while creating the user", 500);
    }

    return res
      .status(201)
      .json(
        new ApiResponse(201, createdUser, "User registered successfully !")
      );
  } catch (error) {
    console.error(" User creation failed!!");
    console.error("MongoDB error message:", error.message);
    console.error("Full error object:", error);

    if (avatar) await deleteFromCloudinary(avatar.public_id);
    if (coverImage) await deleteFromCloudinary(coverImage.public_id);

    throw new ApiError(
      error.message ||
        "Something was wrong while creating the user and Images were deleted",
      500
    );
  }
});

const loginUser = asyncHandler(async (req, res) => {
  //get data from the body
  const { email, username, password } = req.body;

  //validation
  if (!email && !username) {
    throw new ApiError("Email or username is required !!", 404);
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError("User not found !!", 404);
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError("Invalid Credentials", 404);
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    //TODO : Need to Come back here after the middlewares

    req.user._id,
    { $set: { refreshToken: undefined } },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .clearCookie("refreshToken", options)
    .clearCookie("accessToken", options)
    .json(new ApiResponse(200, {}, "User loged out successfully !!"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;

  if (!incomingRefreshToken)
    throw new ApiError("Refresh Token required!!", 401);

  try {
    const decoded = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decoded._id); // make sure your token has _id field

    if (!user) {
      throw new ApiError("Invalid Refresh Token !!", 401);
    }
    if (incomingRefreshToken !== user.refreshToken) {
  return res.status(401).json({ success: false, message: "Invalid Refresh Token !!" });
}


    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    user.refreshToken = newRefreshToken;
    await user.save();

    console.log("Incoming:", incomingRefreshToken);
console.log("Stored:", user.refreshToken);


    await res
      .status(200)
      .cookie("refreshToken", newRefreshToken, options)
      .cookie("accessToken", accessToken, options)
      .json(new ApiResponse(200, "Access Token refreshed successfully!!"));
  }
  
  catch (error) {
    console.error("Refresh Token Error:", error.message);
    console.error(error.stack);

    res.status(500).json({
      success: false,
      message: "Something went wrong while refreshing the access token",
      error: error.message,
    });
  }

});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user?.id);
  const isPasswordValid = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordValid) throw new ApiError("Old Password is incorrect!!", 401);

  user.password = newPassword;

  user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password has been successfully changed!!"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user details !!"));
});

const updateUserDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;
  if (!fullName || !email) {
    throw new ApiError("Fullname and email both required !!", 400);
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email: email,
      },
    },
    {
      new: true,
    }
  ).select("-password -refreshToken");

    if (!user) {
      throw new ApiError("User not found !!", 404);
    }

  return res
    .status(200)
    .json(
      new ApiResponse(200, user, "Successfully updated account details !!")
    );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError("File is required !!", 400);
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError("Something went wrong while uploading avatar!!", 500);
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    {
      new: true,
    }
  ).select("-password -refreshToken");

  return res.status(200).json(new ApiResponse(200, user , "Avatar updated successfully !!")); 
});


const updateUserCoverImage = asyncHandler(async (req, res) => {
  
  const coverImagePath = req.file?.path;

  if (!coverImagePath) {
    throw new ApiError("File is required !!", 400);
  }

  const coverImage = await uploadOnCloudinary(coverImagePath);

  if (!coverImage.url) {
    throw new ApiError("Something went wrong while uploading cover image!!", 500);
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    {
      new: true,
    }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover Image updated successfully !!")); 
});

const getUserChannelprofile  =  asyncHandler(async (req, res) =>{
  const {username} = req.params

  if(!username?.trim()){
    throw new ApiError("UserName is required!!", 400); 
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscriberedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelSubscribedTo: {
          $size: "$subscriberedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      // project only the things required to display in the frontend
      $project: {
        fullName: 1,
        username: 1,
        avatar: 1,
        subscribersCount: 1,
        channelSubscribedTo: 1,
        isSubscribed: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  console.log("Looking for:", username.toLowerCase());
  console.log("Aggregation result:", channel);


  console.log("Channel length: ",channel.length); 
  if(!channel?.length){
    throw new ApiError("Channel not found!!", 400); 
  }
  return res.status(200).json(new ApiResponse(200, channel[0], "Channel profile fetched successfully!!"))
});


const getWatchHistory  =  asyncHandler(async (req, res) =>{

    const user = await User.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(req.user?._id),
        },
      },
      {
        $lookup: {
          from: "videos",
          localField: "watchHistory",
          foreignField: "_id",
          as: "watchHistory",
          pipeline: [
            {
              $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                  {
                    $project: {
                      fullname: 1,
                      username: 1,
                      avatar: 1,
                    },
                  },
                ],
              },
            },
            {
              $addFields: {
                owner: { $first: "$owner" },
              },
            },
          ],
        },
      },
    ]);
    return res.status(200).json(new ApiResponse(200, user[0]?.watchHistory , "Watch history fetched successfully!!"))
}); 

export {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  changeCurrentPassword,
  getCurrentUser,
  updateUserAvatar,
  updateUserCoverImage,
  updateUserDetails,
  getUserChannelprofile,
  getWatchHistory,
};
