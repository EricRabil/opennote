import { keymap } from "prosemirror-keymap"
import { Extension } from "tiptap"
import { redo, undo, yCursorPlugin, ySyncPlugin, yUndoPlugin } from "y-prosemirror/src/y-prosemirror.js";
import { WebrtcProvider, Room } from "y-webrtc/dist/y-webrtc.cjs";
import * as Y from "yjs"
import { EditorState } from "prosemirror-state";

export interface RTCConnectionOptions {
  roomName: string;
  signalingServer: string[];
}

Object.defineProperty(WebrtcProvider.prototype, "room", {
  get() {
    return this._room;
  },
  set(room) {
    this._room = room;
    this.emit("room", [room]);
  }
})

// var canDispatchProsemirrorUpdates = false;

// Object.defineProperty(Room.prototype, "_docUpdateHandler", {
//   get() {
//     if (!this.canDispatchProsemirrorUpdates) return () => undefined;
//     return this.shitty_docUpdateHandler;
//   },
//   set(val) {
//     this.shitty_docUpdateHandler = val;
//   }
// });

// Object.defineProperty(Room.prototype, "_awarenessUpdateHandler", {
//   get() {
//     if (!this.canDispatchProsemirrorUpdates) return () => undefined;
//     return this.shitty_awarenessUpdateHandler;
//   },
//   set(val) {
//     this.shitty_awarenessUpdateHandler = val;
//   }
// });

export default class RealtimeExtension extends Extension {
  rtcProvider: WebrtcProvider;
  doc: Y.Doc;

  constructor(public options: RTCConnectionOptions, onRoom: Function = () => null, onMessage: Function = () => null) {
    super();

    this.doc = new Y.Doc();

    this.rtcProvider = new WebrtcProvider(options.roomName, this.doc as any, {
      signaling: options.signalingServer,
      customEventCallback: (rawData, room) => {
        console.log({
          rawData,
          room
        })
      }
    });

    this.rtcProvider

    console.log(this.rtcProvider);
  }

  send(name: string, payload: any) {
    this.activeRoom?.sendCustomEvent({
      name,
      payload
    });
  }

  get activeRoom() {
    return this.rtcProvider.room;
  }

  get rooms() {
    return Room.rooms;
  }

  close() {
    if (this.rtcProvider) {
      this.rtcProvider.disconnect();
      this.rtcProvider.destroy();
    }
  }

  get docType() {
    return this.doc.getXmlFragment("prosemirror");
  }

  get name() {
    return "realtime"
  }

  get plugins() {
    return [
      ySyncPlugin(this.docType),
      yCursorPlugin(this.rtcProvider.awareness, user => {
        const cursorRoot = document.createElement("div");
        cursorRoot.classList.add("cursor-root");
        cursorRoot.setAttribute("cursor-color", user.color);
        cursorRoot.setAttribute("cursor-name", user.name);
        return cursorRoot;
      }),
      yUndoPlugin(),
      keymap({
        "Mod-z": undo,
        "Mod-y": redo,
        "Mod-Shift-z": redo
      })
    ]
  }
}