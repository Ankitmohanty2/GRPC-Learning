const grpc = require('@grpc/grpc-js');
const { loadProtoFile, resolveProtoPath } = require('../common/proto-loader');

class HealthImplementation {
  constructor() {
    this.statusMap = new Map();
    this.watchers = new Map();
    this.statusMap.set('', 'SERVING');
  }

  setStatus(service, status) {
    this.statusMap.set(service, status);
    const set = this.watchers.get(service);
    if (set) {
      for (const call of set) {
        if (!call.cancelled) {
          call.write({ status });
        }
      }
    }
  }

  getStatus(service) {
    return this.statusMap.get(service) || 'SERVICE_UNKNOWN';
  }

  check(call, callback) {
    const service = call.request?.service || '';
    const status = this.statusMap.get(service);

    if (!status) {
      return callback({
        code: grpc.status.NOT_FOUND,
        details: `Service "${service}" unknown to health checker`,
      });
    }

    callback(null, { status });
  }

  watch(call) {
    const service = call.request?.service || '';
    const currentStatus = this.getStatus(service);

    call.write({ status: currentStatus });

    let set = this.watchers.get(service);
    if (!set) {
      set = new Set();
      this.watchers.set(service, set);
    }
    set.add(call);

    call.on('cancelled', () => {
      set?.delete(call);
    });

    call.on('end', () => {
      set?.delete(call);
      call.end();
    });
  }

  addToServer(server) {
    const protoPath = resolveProtoPath('grpc', 'health', 'v1', 'health.proto');
    const { grpcObject } = loadProtoFile(protoPath);
    const healthPkg = grpcObject.grpc?.health?.v1;

    server.addService(healthPkg.Health.service, {
      check: this.check.bind(this),
      watch: this.watch.bind(this),
    });
  }
}

function registerHealthService(server) {
  const health = new HealthImplementation();
  health.addToServer(server);
  return health;
}

module.exports = {
  HealthImplementation,
  registerHealthService,
};
