# Video Collaboration

A video app implementing a bunch of collaboration features

## Running the application

Clone the application:

```bash
git clone https://github.com/philnash/video-collaboration.git
cd video-collaboration
```

Install the dependencies:

```bash
npm install
```

Copy the `.env.example` file to `.env`.

```bash
cp .env.example .env
```

Fill in your Twilio Account SID and an [API Key and Secret that you can generate in the Twilio console](https://www.twilio.com/console/video/project/api-keys) in the `.env` file.

Run the dev server:

```bash
npm start
```

## Features

* Multi party video chat
* Enable/disable video
* Mute/unmute microphone
* Dominant speaker detection
* Screen share
* Emoji/non-verbal reactions
* Basic text chat
* Interactive whiteboard

## License

MIT (c) Phil Nash 2020
