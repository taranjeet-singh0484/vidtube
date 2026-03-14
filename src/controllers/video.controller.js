import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/videos.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asynHandler.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import { json } from "express";

const getAllVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    query,
    sortBy = "createdAt",
    sortType = "desc",
    userId,
  } = req.query;

  const filter = {};

  if (query) {
    filter.$or = [
      { title: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
    ];
  }

  if (userId) {
    filter.owner = userId;
  }

  const sort = {};
  sort[sortBy] = sortType === "asc" ? 1 : -1;

  const pageNumber = parseInt(page);
  const limitNumber = parseInt(limit);
  const skip = (pageNumber - 1) * limitNumber;

  const videos = await Video.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limitNumber)
    .populate("owner", "username avatar");

  const totalVideos = await Video.countDocuments(filter);

  return res.status(200).json({
    success: true,
    totalVideos,
    page: pageNumber,
    limit: limitNumber,
    totalPages: Math.ceil(totalVideos / limitNumber),
    videos,
  });
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title = "", description = "" } = req.body || {};

  if ([title, description].some((field) => field.trim() === "")) {
    throw new ApiError("Title and description both are required!! ", 400);
  }
  // TODO: get video, upload to cloudinary, create video

  const videoLocalPath = req.files?.video?.[0]?.path;

  if (!videoLocalPath) {
    throw new ApiError("Video not found!!", 400);
  }

  if (!req.files.video[0].mimetype.startsWith("video/")) {
    if (video) await deleteFromCloudinary(video.public_id, video.resource_type);
    // if (thumbnail) await deleteFromCloudinary(thumbnail.public_id);
    throw new ApiError("Uploaded file is not a video", 400);
  }

  let video;
  try {
    console.log("Uploading video:", videoLocalPath);
    video = await uploadOnCloudinary(videoLocalPath);
    console.log("Video file uploaded successfully!!", video);
  } catch (error) {
    throw new ApiError("Failed to upload video", 500);
  }

  const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

  if (!thumbnailLocalPath) {
    if (video) await deleteFromCloudinary(video.public_id, video.resource_type);
    // if (thumbnail) await deleteFromCloudinary(thumbnail.public_id);

    throw new ApiError("Thumbnail not found!!", 400);
  }

  if (!req.files.thumbnail[0].mimetype.startsWith("image/")) {
    if (video) await deleteFromCloudinary(video.public_id, video.resource_type);
    // if (thumbnail) await deleteFromCloudinary(thumbnail.public_id);

    throw new ApiError("Uploaded file is not an image", 400);
  }

  let thumbnail;
  try {
    console.log("Uploading thumbnail :", thumbnailLocalPath);
    thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    console.log("Thumbnail file uploaded successfully!!", thumbnail);
  } catch (error) {
    if (video) await deleteFromCloudinary(video.public_id, video.resource_type);
    if (thumbnail) await deleteFromCloudinary(thumbnail.public_id);

    throw new ApiError("Failed to upload thumbnail", 500);
  }

  if (!req.files?.video || !req.files?.thumbnail) {
    if (video) await deleteFromCloudinary(video.public_id, video.resource_type);
    if (thumbnail) await deleteFromCloudinary(thumbnail.public_id);

    throw new ApiError("Video and thumbnail both are required", 400);
  }

  try {
    const newVideo = await Video.create({
      videoFile: video?.url || "",
      videoId: video.public_id,
      duration: video?.duration || 0,
      owner: req.user._id,
      title,
      description,
      thumbnail: thumbnail?.url || "",
      thumbnailId: thumbnail.public_id,
    });

    const createdVideo = await Video.findById(newVideo._id);

    if (!createdVideo) {
      throw new ApiError("Something went wrong while uploading video ", 500);
    }
    return res
      .status(201)
      .json(
        new ApiResponse(201, createdVideo, "Video published successfully!!")
      );
  } catch (error) {
    console.error(" Video publishing failed!!");
    console.error("MongoDB error message:", error.message);
    console.error("Full error object:", error);

    if (video) await deleteFromCloudinary(video.public_id, video.resource_type);
    if (thumbnail) await deleteFromCloudinary(thumbnail.public_id);

    throw new ApiError(
      error.message ||
        "Something was wrong while posting the video and thumbnail & video file were deleted",
      500
    );
  }
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id
  try {
    const video = await Video.findById(videoId);
  
    return res
    .status(200)
    .json(new ApiResponse(200, video , "Video loaded successfully"))
  } 
  catch (error) {
    throw new ApiError("Video not found !!", 404);
    
  }
});

const updateVideoDetails = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;
  const thumbnailLocalPath = req.file?.path;

  // Find video first
  let video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError("Video not found !!", 404);
  }

  const updateData = {};

  // Update title if provided
  if (title) updateData.title = title;

  // Update description if provided
  if (description) updateData.description = description;

  // Update thumbnail if new file provided
  if (thumbnailLocalPath) {
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!thumbnail) {
      throw new ApiError("Error uploading new thumbnail !!", 500);
    }

    // Delete the old thumbnail from Cloudinary
    if (video.thumbnailId) {
      await deleteFromCloudinary(video.thumbnailId, "image");
    }

    updateData.thumbnail = thumbnail.url;
    updateData.thumbnailId = thumbnail.public_id;
  }

  // Update the video details in DB
  video = await Video.findByIdAndUpdate(
    videoId,
    { $set: updateData },
    { new: true }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video details updated successfully !!"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  //TODO: delete video
  const { videoId } = req.params;
  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError("Video not found !!", 404);
  }
  try {
    if (video.videoId) await deleteFromCloudinary(video.videoId, "video");

    if (video.thumbnailId) await deleteFromCloudinary(video.thumbnailId);

    const result = await Video.findByIdAndDelete(videoId);
    console.log("Video having id : ", videoId, "deleted => ", result);
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Video Deleted successfully !!"));
  } catch {
    throw new ApiError("Failed to delete the video !!", 500);
  }
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError("Video not found !!", 404);
  }
  try {
    video.isPublic = !video.isPublic;
    await video.save();

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { isPublic: video.isPublic },
          `Updated the public status successfully !!`
        )
      );
  } catch (error) {
    throw new ApiError("Failed to update public status !!", 401);
  }
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideoDetails,
  deleteVideo,
  togglePublishStatus,
};
