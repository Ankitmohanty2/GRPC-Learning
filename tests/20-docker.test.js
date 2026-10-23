const fs = require('fs');
const path = require('path');

describe('Lesson 20: Docker Configuration Verification', () => {
  it('defines valid multi-stage or production Dockerfile', () => {
    const dockerfilePath = path.resolve(__dirname, '../docker/Dockerfile');
    expect(fs.existsSync(dockerfilePath)).toBe(true);
    const content = fs.readFileSync(dockerfilePath, 'utf8');
    expect(content).toContain('FROM node:20-alpine');
    expect(content).toContain('EXPOSE 50051 50052 50053');
  });

  it('defines valid multi-service docker-compose architecture', () => {
    const composePath = path.resolve(__dirname, '../docker/docker-compose.yml');
    expect(fs.existsSync(composePath)).toBe(true);
    const content = fs.readFileSync(composePath, 'utf8');
    expect(content).toContain('user-service:');
    expect(content).toContain('product-service:');
    expect(content).toContain('order-service:');
    expect(content).toContain('postgres:');
  });
});
