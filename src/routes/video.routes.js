import { Router } from "express";

import {
  publishAVideo,
  deleteVideo,
  togglePublishStatus,
  updateVideoDetails,
  getVideoById,
  getAllVideos
} from "../controllers/video.controller.js"; 

import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";


const router = Router();

router.route("/post-video").post(
  verifyJWT,
  upload.fields([
    {
      name: "video",
      maxCount: 1,
    },
    {
      name: "thumbnail",
      maxCount: 1,
    },
  ]),
  publishAVideo
);                                                                        //done

router.route("/delete-video/c/:videoId").delete(verifyJWT, deleteVideo);                 //done
router.route("/is-public/c/:videoId").patch(verifyJWT, togglePublishStatus);              //done    
router.route("/get-video/c/:videoId").get(getVideoById);                            //done
router.route("/get-videos/").get(getAllVideos);                                           //done
router.route("/update-video/c/:videoId").patch(verifyJWT,upload.single("thumbnail"), updateVideoDetails);                       //done


export default router; 