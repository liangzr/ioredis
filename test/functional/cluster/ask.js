var calculateSlot = require('cluster-key-slot');
var disconnect = require('./_helpers').disconnect;

describe('cluster:ASK', function () {
  it('should support ASK', function (done) {
    var asked = false;
    var times = 0;
    var slotTable = [
      [0, 1, ['127.0.0.1', 30001]],
      [2, 16383, ['127.0.0.1', 30002]]
    ];
    var node1 = new MockServer(30001, function (argv) {
      if (argv[0] === 'cluster' && argv[1] === 'slots') {
        return slotTable;
      }
      if (argv[0] === 'get' && argv[1] === 'foo') {
        expect(asked).to.eql(true);
      } else if (argv[0] === 'asking') {
        asked = true;
      }
    });
    var node2 = new MockServer(30002, function (argv) {
      if (argv[0] === 'cluster' && argv[1] === 'slots') {
        return slotTable;
      }
      if (argv[0] === 'get' && argv[1] === 'foo') {
        if (++times === 2) {
          process.nextTick(function () {
            cluster.disconnect();
            disconnect([node1, node2], done);
          });
        } else {
          return new Error('ASK ' + calculateSlot('foo') + ' 127.0.0.1:30001');
        }
      }
    });

    var cluster = new Redis.Cluster([
      { host: '127.0.0.1', port: '30001' }
    ], { lazyConnect: false });
    cluster.get('foo', function () {
      cluster.get('foo');
    });
  });

  it('should be able to redirect a command to a unknown node', function (done) {
    var asked = false;
    var slotTable = [
      [0, 16383, ['127.0.0.1', 30002]]
    ];
    var node1 = new MockServer(30001, function (argv) {
      if (argv[0] === 'get' && argv[1] === 'foo') {
        expect(asked).to.eql(true);
        return "bar"
      } else if (argv[0] === 'asking') {
        asked = true;
      }
    });
    var node2 = new MockServer(30002, function (argv) {
      if (argv[0] === 'cluster' && argv[1] === 'slots') {
        return slotTable;
      }
      if (argv[0] === 'get' && argv[1] === 'foo') {
        return new Error('ASK ' + calculateSlot('foo') + ' 127.0.0.1:30001');
      }
    });

    var cluster = new Redis.Cluster([
      { host: '127.0.0.1', port: '30002' }
    ]);
    cluster.get('foo', function (err, res) {
      expect(res).to.eql('bar');
      cluster.disconnect();
      disconnect([node1, node2], done);
    });
  });
});

