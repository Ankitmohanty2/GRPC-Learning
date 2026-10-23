const { runTestSuite } = require('../lessons/19-testing/demo');

describe('Lesson 19: Programmatic Testing Runner', () => {
  it('runs the in-memory test suite successfully', async () => {
    await expect(runTestSuite()).resolves.toBeUndefined();
  });
});
