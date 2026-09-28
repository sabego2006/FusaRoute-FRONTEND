import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoutesDetail } from './routes-detail';

describe('RoutesDetail', () => {
  let component: RoutesDetail;
  let fixture: ComponentFixture<RoutesDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoutesDetail],
    }).compileComponents();

    fixture = TestBed.createComponent(RoutesDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
