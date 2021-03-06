import { observable, makeObservable, action, runInAction } from 'mobx';
import ProfileModel from '../models/Profile';
import SettingsModel from '../models/Settings';
import WindowModel from '../models/Window';
import { Notification, Theme } from '../types/notifications';
import { UpdateProfileRequest, GetProfileRequest, SendConfirmEmailRequest } from '../types/requests';
import RootStore from './RootStore';
import Socket from '../lib/socket';

class ProfileStore {
  rootStore: RootStore;
  socket: Socket;
  profile: ProfileModel = new ProfileModel({
    name: '',
    email: ''
  });
  settings = new SettingsModel();

  constructor(rootStore: RootStore, socket: Socket) {
    this.rootStore = rootStore;
    this.socket = socket;

    makeObservable(this, {
      profile: observable,
      settings: observable,
      fetchProfile: action,
      updateSettings: action
    });
  }

  handlerServerNotification(ntf: Notification): boolean {
    switch (ntf.type) {
      case 'UPDATE_SETTINGS':
        // TODO: activeDesktop is converted to activeWindow here
        const { theme, activeDesktop: activeWindowId, emailConfirmed, canUseIRC } = ntf.settings;
        this.updateSettings(theme, activeWindowId, emailConfirmed, canUseIRC);
        break;
      case 'FINISH_INIT':
        this.fetchProfile();
      default:
        return false;
    }

    return true;
  }

  async updateProfile(
    type: 'name' | 'email' | 'nick',
    value: string
  ): Promise<{ success: boolean; errorMsg?: string }> {
    if (type === 'nick') {
      return { success: false, errorMsg: 'No implemented yet.' };
    }

    const response = await this.socket.send<UpdateProfileRequest>({ id: 'UPDATE_PROFILE', [type]: value });

    if (response.status === 'OK') {
      if (type === 'email') {
        this.setEmailConfirmed();
      }

      this.profile[type] = value;
      return { success: true };
    }

    return { success: false, errorMsg: response.errorMsg };
  }

  async fetchProfile(): Promise<void> {
    const response = await this.socket.send<GetProfileRequest>({ id: 'GET_PROFILE' });

    runInAction(() => {
      this.profile.name = response.name;
      this.profile.email = response.email;
    });
  }

  updateSettings(
    theme?: Theme | undefined,
    activeWindowId?: number | undefined,
    emailConfirmed?: boolean | undefined,
    canUseIRC?: boolean | undefined
  ): void {
    this.settings.theme = theme === undefined ? this.settings.theme : theme;
    this.settings.activeWindowId = activeWindowId === undefined ? this.settings.activeWindowId : activeWindowId;
    this.settings.emailConfirmed = emailConfirmed === undefined ? this.settings.emailConfirmed : emailConfirmed;
    this.settings.canUseIRC = canUseIRC === undefined ? this.settings.canUseIRC : canUseIRC;
  }

  async setTheme(theme: Theme): Promise<void> {
    this.updateSettings(theme);

    await this.socket.send({
      id: 'SET',
      settings: { theme }
    });

    // TODO: Remove when old client is removed
    if (theme === Theme.Default) {
      window.location.href = '/';
    }
  }

  async handleConfirmEmail(): Promise<void> {
    const msg = "Confirmation link sent. Check your spam folder if you don't see it in inbox.";

    await this.socket.send<SendConfirmEmailRequest>({ id: 'SEND_CONFIRM_EMAIL' });

    this.rootStore.alertStore.showAlert(null, msg, 'Okay', false, false, () => {
      this.setEmailConfirmed();
    });
  }

  setEmailConfirmed(): void {
    this.updateSettings(undefined, undefined, true);
  }

  changeActiveWindowId(activeWindow: WindowModel): void {
    if (!this.rootStore.windowStore.initDone) {
      return;
    }

    this.updateSettings(undefined, activeWindow.id);
    this.socket.send({ id: 'SET', settings: { activeDesktop: activeWindow.desktopId } });
  }
}

export default ProfileStore;
