import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MessagesPage } from './messages.page';
import { MessagingService, ConversationSummary } from '../../services/messaging.service';
import { DiningTableService, DiningTable } from '../../services/dining-table.service';

const CONVERSATION: ConversationSummary = {
  id: 1,
  person: { id: 2, name: 'Sara', photoUrl: null },
  lastMessage: { body: 'See you Friday!', senderId: 2, createdAt: new Date().toISOString() },
  unreadCount: 1,
};

const GROUP_TABLE = {
  id: 5,
  title: 'Friday Dinner',
  restaurantId: 9,
  hostUserId: 3,
  gatheringType: 'dinner',
  dateTime: new Date().toISOString(),
  seatsTotal: 4,
  visibility: 'public',
  atmosphere: null,
  note: null,
  pricePerPerson: null,
  createdAt: new Date().toISOString(),
  restaurant: { name: 'Kolachi', photoUrl: null, address: null, rating: 4.8, cuisineTags: 'Pakistani' },
  host: { id: 3, name: 'Phase4 Tester' },
  guestCount: 2,
  isPast: false,
  isHost: true,
  hasReviewed: false,
} as unknown as DiningTable;

describe('MessagesPage', () => {
  let messagingServiceSpy: jasmine.SpyObj<MessagingService>;
  let tableServiceSpy: jasmine.SpyObj<DiningTableService>;

  function createComponent() {
    TestBed.configureTestingModule({
      imports: [MessagesPage],
      providers: [
        provideRouter([]),
        { provide: MessagingService, useValue: messagingServiceSpy },
        { provide: DiningTableService, useValue: tableServiceSpy },
      ],
    });
    return TestBed.createComponent(MessagesPage);
  }

  beforeEach(() => {
    messagingServiceSpy = jasmine.createSpyObj('MessagingService', ['list']);
    tableServiceSpy = jasmine.createSpyObj('DiningTableService', ['listMine']);
  });

  it('loads conversations and dining groups independently on construction', () => {
    messagingServiceSpy.list.and.returnValue(of({ conversations: [CONVERSATION] }));
    tableServiceSpy.listMine.and.returnValue(of({ tables: [GROUP_TABLE] }));

    const fixture = createComponent();
    const page = fixture.componentInstance;

    expect(page.conversations()).toEqual([CONVERSATION]);
    expect(page.loadingConversations()).toBeFalse();
    expect(page.groups()).toEqual([GROUP_TABLE]);
    expect(page.loadingGroups()).toBeFalse();
  });

  it('defaults to the messages tab and switches on selectTab()', () => {
    messagingServiceSpy.list.and.returnValue(of({ conversations: [] }));
    tableServiceSpy.listMine.and.returnValue(of({ tables: [] }));

    const fixture = createComponent();
    const page = fixture.componentInstance;

    expect(page.activeTab()).toBe('messages');
    page.selectTab('groups');
    expect(page.activeTab()).toBe('groups');
  });

  it('stops loading (without crashing) when either request fails', () => {
    messagingServiceSpy.list.and.returnValue(throwError(() => new Error('network error')));
    tableServiceSpy.listMine.and.returnValue(of({ tables: [] }));

    const fixture = createComponent();
    const page = fixture.componentInstance;

    expect(page.loadingConversations()).toBeFalse();
    expect(page.conversations()).toEqual([]);
    expect(page.loadingGroups()).toBeFalse();
  });

  it('renders the real conversation list in the DOM, not placeholder data', () => {
    messagingServiceSpy.list.and.returnValue(of({ conversations: [CONVERSATION] }));
    tableServiceSpy.listMine.and.returnValue(of({ tables: [] }));

    const fixture = createComponent();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Sara');
    expect(text).toContain('See you Friday!');
  });
});
