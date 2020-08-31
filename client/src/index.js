import { createLocalTracks, LocalDataTrack } from "twilio-video";
import { VideoChat } from "./lib/video-chat";
import { hideElements, showElements } from "./lib/utils";
import LocalPreview from "./lib/localPreview";
import { Reactions, allowedReactions } from "./lib/reactions";

let videoTrack, audioTrack, localPreview, videoChat, dataTrack, reactions;

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
  const screenShareBtn = document.getElementById("screen-share");
  const muteBtn = document.getElementById("mute-self");
  const disableVideoBtn = document.getElementById("disable-video");
  const liveControls = document.getElementById("live-controls");

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
      dataTrack = new LocalDataTrack();

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
      dataTrack,
    });
    if (!("getDisplayMedia" in navigator.mediaDevices)) {
      screenShareBtn.remove();
    }
    showElements(videoChatDiv);
    localPreview.hide();
    reactions = new Reactions(liveControls);
    reactions.addEventListener("reaction", (event) => {
      videoChat.sendMessage(
        JSON.stringify({ action: "reaction", reaction: event.detail })
      );
      videoChat.showReaction(event.detail);
    });
  });

  disconnectBtn.addEventListener("click", () => {
    if (!videoChat) {
      return;
    }
    videoChat.disconnect();
    reactions = reactions.destroy();
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

  muteBtn.addEventListener("click", () => {
    if (audioTrack.isEnabled) {
      audioTrack.disable();
      document.addEventListener("keydown", unMuteOnSpaceBarDown);
      document.addEventListener("keyup", muteOnSpaceBarUp);
    } else {
      audioTrack.enable();
      document.removeEventListener("keydown", unMuteOnSpaceBarDown);
      document.removeEventListener("keyup", muteOnSpaceBarUp);
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
