import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePage } from '../base.page';

type ErrorType = 'not-found' | 'offline' | 'generic';

interface ErrorContent {
  icon: string;
  title: string;
  message: string;
}

const CONTENT: Record<ErrorType, ErrorContent> = {
  'not-found': {
    icon: 'search_off',
    title: "Page Not Found",
    message: "We couldn't find the page you were looking for. It may have moved or no longer exists.",
  },
  offline: {
    icon: 'wifi_off',
    title: "You're Offline",
    message: 'Check your internet connection and try again.',
  },
  generic: {
    icon: 'error',
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred. Please try again.',
  },
};

@Component({
  selector: 'app-error',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './error.page.html',
  styleUrl: './error.page.scss',
})
export class ErrorPage extends BasePage implements OnInit {
  readonly pageTitle = 'Error';
  content: ErrorContent = CONTENT['not-found'];

  ngOnInit(): void {
    const type = (this.route.snapshot.queryParamMap.get('type') as ErrorType) || 'not-found';
    this.content = CONTENT[type] ?? CONTENT['not-found'];
  }

  retry(): void {
    window.location.reload();
  }
}
