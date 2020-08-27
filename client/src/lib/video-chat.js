import Video from "twilio-video";
import { showElements, hideElements } from "./utils";

export class VideoChat extends EventTarget {
  constructor(token, roomName, localTracks) {
    super();
    this.videoTrack = localTracks.videoTrack;
    this.audioTrack = localTracks.audioTrack;
    this.container = document.getElementById("participants");
    this.chatDiv = document.getElementById("video-chat");
    this.activityDiv = document.getElementById("activity");
    this.dominantSpeaker = null;
    this.participantItems = new Map();
    this.participantConnected = this.participantConnected.bind(this);
    this.participantDisconnected = this.participantDisconnected.bind(this);
    this.trackPublished = this.trackPublished.bind(this);
    this.trackUnpublished = this.trackUnpublished.bind(this);
    this.trackSubscribed = this.trackSubscribed.bind(this);
    this.trackUnsubscribed = this.trackUnsubscribed.bind(this);
    this.roomDisconnected = this.roomDisconnected.bind(this);
    this.dominantSpeakerChanged = this.dominantSpeakerChanged.bind(this);
    this.tidyUp = this.tidyUp.bind(this);
    this.init(token, roomName);
  }

  async init(token, roomName) {
    try {
      this.room = await Video.connect(token, {
        name: roomName,
        tracks: [this.videoTrack, this.audioTrack],
        dominantSpeaker: true,
      });
      this.participantConnected(this.room.localParticipant);
      this.room.on("participantConnected", this.participantConnected);
      this.room.on("participantDisconnected", this.participantDisconnected);
      this.room.participants.forEach(this.participantConnected);
      this.room.on("disconnected", this.roomDisconnected);
      this.room.on("dominantSpeakerChanged", this.dominantSpeakerChanged);
      window.addEventListener("beforeunload", this.tidyUp);
      window.addEventListener("pagehide", this.tidyUp);
    } catch (error) {
      console.error(error);
    }
  }

  dominantSpeakerChanged(participant) {
    if (this.dominantSpeaker) {
      this.participantItems
        .get(this.dominantSpeaker.sid)
        .classList.remove("dominant");
    }
    let participantItem;
    if (participant) {
      participantItem = this.participantItems.get(participant.sid);
      this.dominantSpeaker = participant;
    } else {
      participantItem = this.participantItems.get(
        this.room.localParticipant.sid
      );
      this.dominantSpeaker = this.room.localParticipant;
    }
    participantItem.classList.add("dominant");
  }

  trackPublished(participant) {
    return (trackPub) => {
      if (trackPub.track) {
        this.trackSubscribed(participant)(trackPub.track);
      }
      trackPub.on("subscribed", this.trackSubscribed(participant));
      trackPub.on("unsubscribed", this.trackUnsubscribed(participant));
    };
  }

  trackSubscribed(participant) {
    return (track) => {
      const item = this.participantItems.get(participant.sid);
      const wrapper = item.querySelector(".video-wrapper");
      const info = item.querySelector(".info");
      if (track.kind === "video") {
        const videoElement = track.attach();
        if (track.name === "user-screen") {
          this.chatDiv.classList.add("screen-share");
          this.activityDiv.appendChild(videoElement);
          showElements(this.activityDiv);
          if (participant !== this.room.localParticipant) {
            this.dispatchEvent(new Event("screen-share-started"));
          }
        } else {
          wrapper.appendChild(videoElement);
        }
      } else if (track.kind === "audio") {
        const audioElement = track.attach();
        wrapper.appendChild(audioElement);
        const mutedHTML = document.createElement("p");
        mutedHTML.appendChild(document.createTextNode("🔇"));
        if (!track.isEnabled) {
          info.appendChild(mutedHTML);
        }
        track.on("enabled", () => {
          mutedHTML.remove();
        });
        track.on("disabled", () => {
          info.appendChild(mutedHTML);
        });
      }
    };
  }

  trackUnsubscribed(participant) {
    return (track) => {
      if (track.kind !== "data") {
        const mediaElements = track.detach();
        mediaElements.forEach((mediaElement) => mediaElement.remove());
      }
      if (track.name === "user-screen") {
        hideElements(this.activityDiv);
        this.chatDiv.classList.remove("screen-share");
        if (participant !== this.room.localParticipant) {
          this.dispatchEvent(new Event("screen-share-stopped"));
        }
      }
    };
  }

  trackUnpublished(trackPub) {
    if (trackPub.track) {
      this.trackUnsubscribed()(trackPub.track);
    }
  }

  participantConnected(participant) {
    const participantItem = document.createElement("li");
    participantItem.setAttribute("id", participant.sid);
    const wrapper = document.createElement("div");
    wrapper.classList.add("video-wrapper");
    const info = document.createElement("div");
    info.classList.add("info");
    wrapper.appendChild(info);
    participantItem.appendChild(wrapper);
    if (participant !== this.room.localParticipant) {
      const actions = document.createElement("div");
      actions.classList.add("actions");
      wrapper.appendChild(actions);
      const name = document.createElement("p");
      name.classList.add("name");
      name.appendChild(document.createTextNode(participant.identity));
      wrapper.appendChild(name);
    }
    this.container.appendChild(participantItem);
    this.setRowsAndColumns(this.room);
    this.participantItems.set(participant.sid, participantItem);
    participant.tracks.forEach(this.trackPublished(participant));
    participant.on("trackPublished", this.trackPublished(participant));
    participant.on("trackUnpublished", this.trackUnpublished);
  }

  participantDisconnected(participant) {
    const item = this.participantItems.get(participant.sid);
    item.remove();
    this.participantItems.delete(participant.sid);
    this.setRowsAndColumns(this.room);
  }

  roomDisconnected(room, error) {
    if (error) {
      console.error(error);
    }
    this.participantItems.forEach((item, sid) => {
      item.remove();
      this.participantItems.delete(sid);
    });
    this.room = null;
  }

  disconnect() {
    this.room.disconnect();
  }

  tidyUp(event) {
    if (event.persisted) {
      return;
    }
    if (this.room) {
      this.room.disconnect();
      this.room = null;
    }
  }

  setRowsAndColumns(room) {
    const numberOfParticipants =
      Array.from(room.participants.keys()).length + 1;
    let rows, cols;
    if (numberOfParticipants === 1) {
      rows = 1;
      cols = 1;
    } else if (numberOfParticipants === 2) {
      rows = 1;
      cols = 2;
    } else if (numberOfParticipants < 5) {
      rows = 2;
      cols = 2;
    } else if (numberOfParticipants < 7) {
      rows = 2;
      cols = 3;
    } else {
      rows = 3;
      cols = 3;
    }
    this.container.style.setProperty("--grid-rows", rows);
    this.container.style.setProperty("--grid-columns", cols);
  }

  startScreenShare(screenTrack) {
    this.room.localParticipant.publishTrack(screenTrack);
  }

  stopScreenShare(screenTrack) {
    this.room.localParticipant.unpublishTrack(screenTrack);
    this.chatDiv.classList.remove("screen-share");
    hideElements(this.activityDiv);
  }
}
