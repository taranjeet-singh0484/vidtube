import { Router } from "express";

import {
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
} from "../controllers/user.controller.js";

import { upload } from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";
// import { verify } from "jsonwebtoken";

const router = Router();

router.route("/register").post(
    upload.fields([
        {
            name: "avatar", 
            maxCount : 1
        },
        {
            name: "coverImage", 
            maxCount : 1
        }
    ])
    , registerUser);


router.route("/login").post(loginUser);                             //done
router.route("/refresh-token").post(refreshAccessToken);

//secured route
router.route("/logout").post(verifyJWT, logoutUser);                    //done
router.route("/change-password").post(verifyJWT, changeCurrentPassword);                    //done
router.route("/current-user").post(verifyJWT, getCurrentUser);                                        //done
router.route("/c/:username").post(verifyJWT ,getUserChannelprofile);                             //done
router.route("/update-user-details").post(verifyJWT ,updateUserDetails);                          //done
router.route("/avatar").patch(verifyJWT , upload.single("avatar"), updateUserAvatar);                           //done
router.route("/coverImage").patch(verifyJWT , upload.single("coverImage"), updateUserCoverImage);               //done
router.route("/history").get(verifyJWT , getWatchHistory)                                       //done



export default router;
