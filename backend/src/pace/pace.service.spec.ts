import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PaceService } from './pace.service';
import { of } from 'rxjs';

describe('PaceService', () => {
  let service: PaceService;

  const mockConfigService = {
    get: jest.fn().mockReturnValue({
      baseUrl: 'https://test.wallacegraphics.com/rpc/rest/services',
      username: 'testuser',
      password: 'testpass',
    }),
  };

  const mockHttpService = {
    post: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaceService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<PaceService>(PaceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createJobShipment', () => {
    it('should create a shipment successfully', async () => {
      const mockResponse = {
        data: { id: '12345', success: true },
      };

      mockHttpService.post.mockReturnValue(of(mockResponse));

      const request = {
        job: 'TEST-001',
        shipmentType: 50,
        shipVia: 1,
        quantity: 1,
        contactLastName: 'Doe',
        contactFirstName: 'John',
        address1: '123 Test St',
        zip: '12345',
        city: 'Test City',
        country: 1,
        stateKey: '1:TX',
        dateTime: '2023-07-24T12:00:00Z',
        cost: 10.5,
        charges: 'Prepaid/Shipper',
        weight: 5,
        shipped: true,
        trackingNumber: '1Z123456789',
        carton1Count: 1,
        count1: 1,
        carton1Quantity: 1,
        u_internalShipNotes: 'Test shipment',
      };

      const result = await service.createJobShipment(request);

      expect(result.success).toBe(true);
      expect(result.shipmentId).toBe('12345');
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'https://test.wallacegraphics.com/rpc/rest/services/CreateObject/createJobShipment',
        request,
        expect.objectContaining({
          auth: {
            username: 'testuser',
            password: 'testpass',
          },
        }),
      );
    });
  });

  describe('getShipViaOptions', () => {
    it('should return ship via options', () => {
      const options = service.getShipViaOptions();

      expect(options).toBeInstanceOf(Array);
      expect(options.length).toBeGreaterThan(0);
      expect(options[0]).toHaveProperty('id');
      expect(options[0]).toHaveProperty('carrier');
      expect(options[0]).toHaveProperty('service');
    });
  });

  describe('getShipmentTypes', () => {
    it('should return shipment types', () => {
      const types = service.getShipmentTypes();

      expect(types).toBeInstanceOf(Array);
      expect(types.length).toBeGreaterThan(0);
      expect(types[0]).toHaveProperty('id');
      expect(types[0]).toHaveProperty('name');
    });
  });

  describe('getShipViaId', () => {
    it('should return correct ship via ID for UPS Ground', () => {
      const id = service.getShipViaId('UPS', 'Ground');
      expect(id).toBe(1);
    });

    it('should return null for unknown carrier/service', () => {
      const id = service.getShipViaId('Unknown', 'Service');
      expect(id).toBeNull();
    });
  });

  describe('formatStateKey', () => {
    it('should format state key correctly', () => {
      const stateKey = service.formatStateKey('tx');
      expect(stateKey).toBe('1:TX');
    });
  });
});
