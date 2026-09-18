import { showNotification } from '../notifications';

export class NotificationService {
  public notify(title: string, body: string): void {
    showNotification(title, body);
  }
}

export const notificationService = new NotificationService();
