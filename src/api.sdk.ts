import axiosLib from "axios";
import { LocalState } from "./store";

const axios = axiosLib.create({
  withCredentials: true
})

export interface UserModel {
  id: string;
  username: string | null;
  email: string;
  avatar: string | null;
}

export interface FileModel {
  id: string;
  selector: string;
  name: string;
}

export interface NoteModel {
  id: string;
  data: any;
  name: string;
  authorId: string | null;
  shortCode: string;
  created: number;
}

export type PreferenceModel = LocalState["preferences"];

export class ONoteSDK {
  constructor(public readonly baseURL: string) {}
  static devSDK = new ONoteSDK(`http://${window.location.hostname}:8090`);

  async fetchUserModel(): Promise<UserModel | null> {
    return axios.get(`${this.baseURL}/api/v1/user/me`).then(res => res.data).catch(err => null);
  }

  async fetchAcceptableLoginMethods(): Promise<string[]> {
    return axios.get(`${this.baseURL}/api/v1/auth/methods`).then(res => res.data.methods);
  }

  async patchUser(patches: Partial<UserModel>): Promise<UserModel> {
    return axios.patch(`${this.baseURL}/api/v1/user/me`, patches).then(res => res.data);
  }

  async createToken(): Promise<string> {
    return axios.get(`${this.baseURL}/api/v1/user/me/token`).then(res => res.data.token);
  }

  async refreshToken(token: string): Promise<string | null> {
    return axios.post(`${this.baseURL}/api/v1/auth/refresh`, { token }).then(res => res.data.token).catch(e => null);
  }

  async createNote(data: any, name: string): Promise<NoteModel> {
    return axios.post(`${this.baseURL}/api/v1/notes/new`, { data, name }).then(res => res.data);
  }

  async deleteNote(id: string): Promise<void> {
    return axios.delete(`${this.baseURL}/api/v1/notes/${id}`);
  }

  async editNote(id: string, edits: Partial<NoteModel>): Promise<NoteModel> {
    return axios.patch(`${this.baseURL}/api/v1/notes/${id}`, edits).then(res => res.data);
  }

  async getNote(id: string): Promise<NoteModel | null> {
    return axios.get(`${this.baseURL}/api/v1/notes/${id}`).then(res => res.data);
  }

  async cloudNotes(): Promise<NoteModel[]> {
    return axios.get(`${this.baseURL}/api/v1/notes/me`).then(res => res.data.notes);
  }

  async updatePreferences(preferences: PreferenceModel): Promise<PreferenceModel> {
    return axios.patch(`${this.baseURL}/api/v1/user/me/preferences`, { preferences }).then(res => res.data);
  }

  async setAvatar(avatar: File): Promise<FileModel> {
    const formData = new FormData();
    formData.append("image", avatar!);
    return axios.patch(`${this.baseURL}/api/v1/user/me/avatar`, formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
  }

  resolveFilePath(selector: string): string {
    return `${this.baseURL}/api/v1/file/${selector}`;
  }

  triggerAuthenticationFlowForMethod(method: string) {
    window.location.href = `${this.baseURL}/api/v1/auth/${method}`;
  }
}