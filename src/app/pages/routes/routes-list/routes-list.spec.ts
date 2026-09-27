import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoutesList } from './routes-list';

describe('RoutesList', () => {
  let component: RoutesList;
  let fixture: ComponentFixture<RoutesList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoutesList],
    }).compileComponents();

    fixture = TestBed.createComponent(RoutesList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
