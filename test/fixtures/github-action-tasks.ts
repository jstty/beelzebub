import { BzTasks } from 'beelzebub';

import { fixtureOutput } from './github-action-helper.js';

export default class ActionFixture extends BzTasks {
  async run(vars: Record<string, unknown> = {}): Promise<string> {
    await this.workflow.setOutput('fixture-output', fixtureOutput);
    if (Object.keys(vars).length > 0) {
      await this.workflow.setOutput('variable-output', JSON.stringify(vars));
    }
    await this.workflow.summary.heading('Fixture summary', 2).paragraph('It worked.').write();
    return fixtureOutput;
  }

  fail(): never {
    throw new Error('expected handled failure');
  }

  handledFailure() {
    return this.$pipeline([{ id: 'optional', task: '.fail', continueOnError: true }]);
  }
}
