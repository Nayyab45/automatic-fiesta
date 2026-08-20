import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

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
    icon: 'error_outline',
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
export class ErrorPage implements OnInit {
  readonly pageTitle = 'Error';
  content: ErrorContent = CONTENT['not-found'];

  constructor(
    private router: Router,
    private location: Location,
    private route: ActivatedRoute,
  ) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

  ngOnInit(): void {
    const type = (this.route.snapshot.queryParamMap.get('type') as ErrorType) || 'not-found';
    this.content = CONTENT[type] ?? CONTENT['not-found'];
  }

  retry(): void {
    window.location.reload();
  }
}
