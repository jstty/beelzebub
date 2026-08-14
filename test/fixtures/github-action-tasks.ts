import { BzTasks } from 'beelzebub';

export default class ActionFixture extends BzTasks {
  async run(): Promise<string> {
    await this.workflow.setOutput('fixture-output', 'ok');
    await this.workflow.summary.heading('Fixture summary', 2).paragraph('It worked.').write();
    return 'ok';
  }

  fail(): never {
    throw new Error('expected handled failure');
  }

  handledFailure() {
    return this.$pipeline([{ id: 'optional', task: '.fail', continueOnError: true }]);
  }
}
