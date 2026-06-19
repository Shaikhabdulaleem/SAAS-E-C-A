import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('verifies a password against its hash', async () => {
    const hash = await service.hash('admin123');

    await expect(service.verify('admin123', hash)).resolves.toBe(true);
    await expect(service.verify('wrong-password', hash)).resolves.toBe(false);
  });
});
