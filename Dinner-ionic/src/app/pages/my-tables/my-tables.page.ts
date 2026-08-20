import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { LocationService } from '../../services/location.service';

@Component({
  selector: 'app-my-tables',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './my-tables.page.html',
  styleUrl: './my-tables.page.scss',
})
export class MyTablesPage {
  readonly pageTitle = "My Tables";


  constructor(private router: Router, private location: Location, public cityService: LocationService) {}

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  goBack(): void {
    this.location.back();
  }

}
