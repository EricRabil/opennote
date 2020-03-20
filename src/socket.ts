import Store from './store';

interface Payload {
  action: string;
  data?: any;
  nonce?: string;
  method?: string;
}

export class ONoteSocket {
  private _socket: WebSocket | null;
  private resolutionMap: {
    [nonce: string]: Function;
  };

  crudAccepter: (note: string, packet: any) => any;

  constructor(private _url: string | null = null, private _token: string | null = null) {

  }

  get token() {
    return this._token || null;
  }

  set token(newToken: string | null) {
    if (this._token = newToken) {
      this.refresh();
    } else {
      this.close();
    }
  }

  get url() {
    return this._url;
  }

  set url(url: string | null) {
    if (this._url = url) {
      this.refresh();
    } else {
      this.close();
    }
  }

  close() {
    if (!this._socket) return;
    this._socket.close();
    this._socket = null;
  }

  refresh() {
    if (!this.url || !this.token) return;
    this._socket = new WebSocket(this.url!);
    this._socket.addEventListener('message', (message: any) => {
      try {
        message = JSON.parse(message.data);
      } catch (e) {
        console.warn('Malformed payload from server', message.data);
        return;
      }

      if (!message.action) {
        return this.handleCustomPayload(message.action);
      }

      this.receive(message);
    });
  }

  send(payload: Payload): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!payload.action) {
        return reject(new Error("Actions are required to send payloads."));
      }
      if (payload.nonce) {
        this.resolutionMap[payload.nonce] = resolve;
        // clear the resolution register after one minute
        setTimeout(() => {
          delete this.resolutionMap[payload.nonce!];
        }, 1000 * 60);
      }
      this.sendRaw(JSON.stringify(payload));
    });
  }

  get closed() {
    return this._socket ? this._socket.readyState === this._socket.CLOSED : true;
  }

  sendRaw(payload: any) {
    this._socket!.send(payload);
  }

  handleCustomPayload(payload: any) {
    // no-op, future
  }

  receive(payload: Payload) {
    switch (payload.action) {
      case "init":
        this.send({
          action: "init",
          data: {
            token: this._token
          }
        });
        break;
      case "ready":
        console.log('Socket got ready event', payload);
        if (Store.state.currentNote) {
          this.send({
            action: "subscribe",
            data: {
              note: Store.state.currentNote
            }
          })
        }
        break;
      case "/update/note/subscribers":
        // note subscribers did update
        console.log('Socket got subscriber update event', payload);
        break;
      case "/note/crud":
        // note did update with crud
        if (Store.state.preferences.enableCollaborationMode && this.crudAccepter) {
          this.crudAccepter(payload.data!.note, payload.data!.packet);
        }
        break;
      case "/update/user":
        var { data } = payload;
        if (!data) return;
        if (data.preferences) Store.commit('overwritePreferences', data.preferences);
        break;
      case "response":
        // nonce resolved
        var { nonce, data } = payload;
        if (!nonce) {
          // nonce must be present to process a response.
          break;
        }
        const resolve = this.resolutionMap[nonce];
        if (!resolve) {
          // resolve must be present to process a response.
          break;
        }
        resolve(data);
        break;
    }
  }
}