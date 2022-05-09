import { createLocalTracks } from "twilio-video";
import { VideoChat } from "./lib/video-chat";
import { hideElements, showElements } from "./lib/utils";
import LocalPreview from "./lib/localPreview";
import { ScreenSharer } from "./lib/screen-sharer";
import { getVolume } from "./lib/volume-meter";

let videoTrack,
  audioTrack,
  localPreview,
  videoChat,
  screenSharer,
  cloneAudioTrack,
  stopVolumeChecker;

const setupTrackListeners = (track, button, enableLabel, disableLabel) => {
  button.innerText = track.isEnabled ? disableLabel : enableLabel;
  track.on("enabled", () => {
    button.innerText = disableLabel;
  });
  track.on("disabled", () => {
    button.innerText = enableLabel;
  });
};

window.addEventListener("DOMContentLoaded", () => {
  const previewBtn = document.getElementById("media-preview");
  const startDiv = document.querySelector(".start");
  const videoChatDiv = document.getElementById("video-chat");
  const joinForm = document.getElementById("join-room");
  const disconnectBtn = document.getElementById("disconnect");
  const screenShareBtn = document.getElementById("share-screen");
  const muteBtn = document.getElementById("mute-self");
  const disableVideoBtn = document.getElementById("disable-video");
  const muteWarning = document.getElementById("warning");

  previewBtn.addEventListener("click", async () => {
    hideElements(startDiv);
    try {
      const tracks = await createLocalTracks({
        video: {
          name: "user-camera",
          facingMode: "user",
        },
        audio: {
          name: "user-audio",
        },
      });
      startDiv.remove();
      showElements(joinForm);
      videoTrack = tracks.find((track) => track.kind === "video");
      audioTrack = tracks.find((track) => track.kind === "audio");

      setupTrackListeners(audioTrack, muteBtn, "Unmute", "Mute");
      setupTrackListeners(
        videoTrack,
        disableVideoBtn,
        "Enable video",
        "Disable video"
      );

      localPreview = new LocalPreview(videoTrack, audioTrack);
      localPreview.addEventListener("new-video-track", (event) => {
        videoTrack = event.detail;
        setupTrackListeners(
          event.detail,
          disableVideoBtn,
          "Enable video",
          "Disable video"
        );
      });
      localPreview.addEventListener("new-audio-track", (event) => {
        audioTrack = event.detail;
        setupTrackListeners(event.detail, muteBtn, "Unmute", "Mute");
      });
    } catch (error) {
      showElements(startDiv);
      console.error(error);
    }
  });

  joinForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const inputs = joinForm.querySelectorAll("input");
    const data = {};
    inputs.forEach((input) => (data[input.getAttribute("name")] = input.value));
    const { token, roomName } = await fetch(joinForm.getAttribute("action"), {
      method: joinForm.getAttribute("method"),
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    }).then((res) => res.json());
    hideElements(joinForm);
    videoChat = new VideoChat(token, roomName, {
      videoTrack,
      audioTrack,
    });
    if (!("getDisplayMedia" in navigator.mediaDevices)) {
      screenShareBtn.remove();
    }
    showElements(videoChatDiv);
    localPreview.hide();
    screenSharer = new ScreenSharer(screenShareBtn, videoChat);
    videoChat.addEventListener("screen-share-started", () => {
      screenSharer.disable();
    });
    videoChat.addEventListener("screen-share-stopped", screenSharer.enable);
  });

  disconnectBtn.addEventListener("click", () => {
    if (!videoChat) {
      return;
    }
    if (stopVolumeChecker) {
      stopVolumeChecker();
    }
    screenSharer = screenSharer.destroy();
    videoChat.disconnect();
    hideElements(videoChatDiv);
    localPreview.show();
    showElements(joinForm);
    videoChat = null;
  });

  const unMuteOnSpaceBarDown = (event) => {
    if (event.keyCode === 32) {
      audioTrack.enable();
    }
  };

  const muteOnSpaceBarUp = (event) => {
    if (event.keyCode === 32) {
      audioTrack.disable();
    }
  };

  muteBtn.addEventListener("click", async () => {
    if (audioTrack.isEnabled) {
      cloneAudioTrack = audioTrack.mediaStreamTrack.clone();
      audioTrack.disable();
      let isShowingMessage = false;
      stopVolumeChecker = await getVolume(
        cloneAudioTrack,
        (bufferLength, samples) => {
          if (
            !isShowingMessage &&
            samples.reduce((acc, sample) => acc + sample, 0) / bufferLength > 70
          ) {
            console.log("Are you talking? You seem to be on mute");
            muteWarning.removeAttribute("hidden");
            isShowingMessage = true;
            setTimeout(() => {
              isShowingMessage = false;
              muteWarning.setAttribute("hidden", "hidden");
            }, 3000);
          }
        }
      );
      document.addEventListener("keydown", unMuteOnSpaceBarDown);
      document.addEventListener("keyup", muteOnSpaceBarUp);
    } else {
      await stopVolumeChecker();
      stopVolumeChecker = null;
      cloneAudioTrack = null;
      audioTrack.enable();
      document.removeEventListener("keydown", unMuteOnSpaceBarDown);
      document.removeEventListener("keyup", muteOnSpaceBarUp);
      muteWarning.setAttribute("hidden", "hidden");
    }
  });

  disableVideoBtn.addEventListener("click", () => {
    if (videoTrack.isEnabled) {
      videoTrack.disable();
    } else {
      videoTrack.enable();
    }
  });
});
