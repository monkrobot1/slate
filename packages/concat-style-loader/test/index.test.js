const compiler = require('./helpers/compiler');

test('Inserts name and outputs JavaScript', async () => {
  const stats = await compiler(require.resolve('./helpers/app.js'));
  const output = stats.toJson().modules[1].source;

  expect(output).toBe(`export default "Hey Alice!\\n"`);
});
