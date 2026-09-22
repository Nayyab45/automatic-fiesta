import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DiningGroupChatPage } from './dining-group-chat.page';
import { DiningTable, DiningTableService, TableGuest, TableMessage } from '../../services/dining-table.service';
import { ConversationPerson, DirectMessage, MessagingService } from '../../services/messaging.service';
import { AuthService } from '../../services/auth.service';

const TABLE = {
  id: 5,
  restaurant: { name: 'Kolachi', address: '123 Do Darya', latitude: null, longitude: null },
} as unknown as DiningTable;
const GUEST: TableGuest = { id: 1, name: 'Bilal', role: null, isHost: false };
const PERSON: ConversationPerson = { id: 2, name: 'Sara', photoUrl: null };

function tableMessage(overrides: Partial<TableMessage> = {}): TableMessage {
  return { id: 1, tableId: 5, senderId: 9, senderName: 'Sara', body: 'Hi!', createdAt: new Date().toISOString(), ...overrides };
}

function directMessage(overrides: Partial<DirectMessage> = {}): DirectMessage {
  return { id: 1, conversationId: 2, senderId: 9, senderName: 'Sara', body: 'Hi!', createdAt: new Date().toISOString(), ...overrides };
}

function fakeRoute(id: string | null, mode?: string) {
  return {
    snapshot: { paramMap: convertToParamMap(id ? { id } : {}), data: mode ? { mode } : {} },
    paramMap: of(convertToParamMap(id ? { id } : {})),
  } as unknown as ActivatedRoute;
}

describe('DiningGroupChatPage', () => {
  let tableServiceSpy: jasmine.SpyObj<DiningTableService>;
  let messagingServiceSpy: jasmine.SpyObj<MessagingService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  function createComponent(id: string | null, mode?: string) {
    TestBed.configureTestingModule({
      imports: [DiningGroupChatPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: fakeRoute(id, mode) },
        { provide: DiningTableService, useValue: tableServiceSpy },
        { provide: MessagingService, useValue: messagingServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
      ],
    });
    return TestBed.createComponent(DiningGroupChatPage);
  }

  beforeEach(() => {
    tableServiceSpy = jasmine.createSpyObj('DiningTableService', ['get', 'guests', 'messages', 'sendMessage']);
    messagingServiceSpy = jasmine.createSpyObj('MessagingService', ['get', 'messages', 'markRead', 'sendMessage']);
    authServiceSpy = jasmine.createSpyObj('AuthService', ['currentUser']);
    authServiceSpy.currentUser.and.returnValue({ id: 9, name: 'Sam Ali' } as never);
  });

  describe('table mode', () => {
    beforeEach(() => {
      tableServiceSpy.get.and.returnValue(of({ table: TABLE }));
      tableServiceSpy.guests.and.returnValue(of({ guests: [GUEST] }));
      tableServiceSpy.messages.and.returnValue(of({ messages: [tableMessage({ senderId: 9 }), tableMessage({ id: 2, senderId: 1 })] }));
    });

    it('loads the table, guests, and messages, marking each bubble as mine based on the sender', () => {
      const fixture = createComponent('5');
      const page = fixture.componentInstance;

      expect(page.table()).toEqual(TABLE);
      expect(page.guests()).toEqual([GUEST]);
      expect(page.loading()).toBeFalse();
      expect(page.bubbles().map((b) => b.isMine)).toEqual([true, false]);
    });

    it('mapsUrl() builds a maps link from the table\'s restaurant', () => {
      const fixture = createComponent('5');
      expect(fixture.componentInstance.mapsUrl()).toContain('google.com/maps');
    });

    it('sendMessage() posts through the table service and appends the returned message', () => {
      tableServiceSpy.sendMessage.and.returnValue(of({ message: tableMessage({ id: 3, body: 'New message', senderId: 9 }) }));
      const fixture = createComponent('5');
      const page = fixture.componentInstance;
      const input = document.createElement('input');
      input.value = 'New message';

      page.sendMessage(input);

      expect(tableServiceSpy.sendMessage).toHaveBeenCalledWith('5', 'New message');
      expect(page.bubbles().some((b) => b.body === 'New message')).toBeTrue();
      expect(input.value).toBe('');
      expect(page.sending()).toBeFalse();
    });
  });

  describe('DM mode', () => {
    beforeEach(() => {
      messagingServiceSpy.get.and.returnValue(of({ conversation: { id: 2, person: PERSON } }));
      messagingServiceSpy.messages.and.returnValue(of({ messages: [directMessage()] }));
      messagingServiceSpy.markRead.and.returnValue(of({}));
    });

    it('loads the DM person and messages, and marks the conversation read', () => {
      const fixture = createComponent('2', 'dm');
      const page = fixture.componentInstance;

      expect(page.dmPerson()).toEqual(PERSON);
      expect(page.bubbles().length).toBe(1);
      expect(messagingServiceSpy.markRead).toHaveBeenCalledWith('2');
      expect(page.loading()).toBeFalse();
    });

    it('mapsUrl() is empty in DM mode -- there is no table/restaurant', () => {
      const fixture = createComponent('2', 'dm');
      expect(fixture.componentInstance.mapsUrl()).toBe('');
    });

    it('sendMessage() posts through the messaging service, not the table service', () => {
      messagingServiceSpy.sendMessage.and.returnValue(of({ message: directMessage({ id: 3, body: 'Hey!', senderId: 9 }) }));
      const fixture = createComponent('2', 'dm');
      const page = fixture.componentInstance;
      const input = document.createElement('input');
      input.value = 'Hey!';

      page.sendMessage(input);

      expect(messagingServiceSpy.sendMessage).toHaveBeenCalledWith('2', 'Hey!');
      expect(tableServiceSpy.sendMessage).not.toHaveBeenCalled();
      expect(page.bubbles().some((b) => b.body === 'Hey!')).toBeTrue();
    });

    it('sendMessage() sets a specific error when the send fails (e.g. a failed token refresh)', () => {
      messagingServiceSpy.sendMessage.and.returnValue(throwError(() => new Error('401')));
      const fixture = createComponent('2', 'dm');
      const page = fixture.componentInstance;
      const input = document.createElement('input');
      input.value = 'Hey!';

      page.sendMessage(input);

      expect(page.sending()).toBeFalse();
      expect(page.sendError()).toContain("didn't send");
    });

    it('sendMessage() ignores empty/whitespace-only input', () => {
      const fixture = createComponent('2', 'dm');
      const input = document.createElement('input');
      input.value = '   ';

      fixture.componentInstance.sendMessage(input);

      expect(messagingServiceSpy.sendMessage).not.toHaveBeenCalled();
    });
  });

  it('does not load anything and stops loading when there is no route id', () => {
    const fixture = createComponent(null);
    expect(tableServiceSpy.get).not.toHaveBeenCalled();
    expect(messagingServiceSpy.get).not.toHaveBeenCalled();
    expect(fixture.componentInstance.loading()).toBeFalse();
  });
});
