import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ConversationPerson {
  id: number;
  name: string;
  photoUrl: string | null;
}

export interface ConversationSummary {
  id: number;
  person: ConversationPerson | null;
  lastMessage: { body: string; senderId: number; createdAt: string } | null;
  unreadCount: number;
}

export interface DirectMessage {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  body: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class MessagingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/conversations`;

  list(): Observable<{ conversations: ConversationSummary[] }> {
    return this.http.get<{ conversations: ConversationSummary[] }>(this.baseUrl);
  }

  getOrCreateWith(recipientId: number | string): Observable<{ conversation: { id: number; person: ConversationPerson | null } }> {
    return this.http.post<{ conversation: { id: number; person: ConversationPerson | null } }>(this.baseUrl, { recipientId });
  }

  get(conversationId: number | string): Observable<{ conversation: { id: number; person: ConversationPerson | null } }> {
    return this.http.get<{ conversation: { id: number; person: ConversationPerson | null } }>(`${this.baseUrl}/${conversationId}`);
  }

  messages(conversationId: number | string): Observable<{ messages: DirectMessage[] }> {
    return this.http.get<{ messages: DirectMessage[] }>(`${this.baseUrl}/${conversationId}/messages`);
  }

  sendMessage(conversationId: number | string, body: string): Observable<{ message: DirectMessage }> {
    return this.http.post<{ message: DirectMessage }>(`${this.baseUrl}/${conversationId}/messages`, { body });
  }

  markRead(conversationId: number | string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/${conversationId}/read`, {});
  }

  /** Deletes the conversation from the caller's own inbox only -- the other
   * person's copy and the message history itself are untouched. Sending a
   * new message into it afterward (from either side) brings it back. */
  delete(conversationId: number | string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${conversationId}`);
  }
}
