import Video from "twilio-video";

export class VideoChat extends EventTarget {
  constructor(token, roomName, localTracks) {
    super();
    this.videoTrack = localTracks.videoTrack;
    this.audioTrack = localTracks.audioTrack;
    this.dataTrack = localTracks.dataTrack;
    this.container = document.getElementById("participants");
    this.chatDiv = document.getElementById("video-chat");
    this.dominantSpeaker = null;
    this.participantItems = new Map();
    this.participantConnected = this.participantConnected.bind(this);
    this.participantDisconnected = this.participantDisconnected.bind(this);
    this.trackPublished = this.trackPublished.bind(this);
    this.trackUnpublished = this.trackUnpublished.bind(this);
    this.trackSubscribed = this.trackSubscribed.bind(this);
    this.trackUnsubcribed = this.trackUnsubcribed.bind(this);
    this.messageReceived = this.messageReceived.bind(this);
    this.roomDisconnected = this.roomDisconnected.bind(this);
    this.dominantSpeakerChanged = this.dominantSpeakerChanged.bind(this);
    this.localParticipantTrackPublished = this.localParticipantTrackPublished.bind(
      this
    );
    this.tidyUp = this.tidyUp.bind(this);
    this.init(token, roomName);
  }

  async init(token, roomName) {
    try {
      this.room = await Video.connect(token, {
        name: roomName,
        tracks: [this.videoTrack, this.audioTrack, this.dataTrack],
        dominantSpeaker: true,
      });
      this.participantConnected(this.room.localParticipant);
      this.room.on("participantConnected", this.participantConnected);
      this.room.on("participantDisconnected", this.participantDisconnected);
      this.room.participants.forEach(this.participantConnected);
      this.room.on("disconnected", this.roomDisconnected);
      this.room.on("dominantSpeakerChanged", this.dominantSpeakerChanged);
      this.room.localParticipant.on(
        "trackPublished",
        this.localParticipantTrackPublished
      );
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
      trackPub.on("unsubscribed", this.trackUnsubcribed(participant));
    };
  }

  localParticipantTrackPublished(track) {
    if (track.kind === "data") {
      const dataTrackPublishedEvent = new CustomEvent("data-track-published", {
        detail: {
          track,
          participant: this.room.localParticipant,
        },
      });
      this.dispatchEvent(dataTrackPublishedEvent);
    }
  }

  trackSubscribed(participant) {
    return (track) => {
      const item = this.participantItems.get(participant.sid);
      const wrapper = item.querySelector(".video-wrapper");
      const info = item.querySelector(".info");
      const muteBtn = item.querySelector(".actions button");
      if (track.kind === "video") {
        const videoElement = track.attach();
        wrapper.appendChild(videoElement);
      } else if (track.kind === "audio") {
        const audioElement = track.attach();
        wrapper.appendChild(audioElement);
        const mutedHTML = document.createElement("p");
        mutedHTML.appendChild(document.createTextNode("🔇"));
        if (!track.isEnabled) {
          if (muteBtn) {
            muteBtn.innerText = "Unmute";
          }
          info.appendChild(mutedHTML);
        }
        track.on("enabled", () => {
          if (muteBtn) {
            muteBtn.innerText = "Mute";
          }
          mutedHTML.remove();
        });
        track.on("disabled", () => {
          if (muteBtn) {
            muteBtn.innerText = "Unmute";
          }
          info.appendChild(mutedHTML);
        });
      } else if (track.kind === "data") {
        track.on("message", this.messageReceived(participant));
      }
    };
  }

  trackUnsubcribed() {
    return (track) => {
      if (track.kind !== "data") {
        const mediaElements = track.detach();
        mediaElements.forEach((mediaElement) => mediaElement.remove());
      }
    };
  }

  trackUnpublished(trackPub) {
    if (trackPub.track) {
      this.trackUnscribed(trackPub.track);
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
      const mute = document.createElement("button");
      mute.appendChild(document.createTextNode("mute"));
      actions.appendChild(mute);
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

  messageReceived(participant) {
    return (message) => {};
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
}
