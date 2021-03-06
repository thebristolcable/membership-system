import { getRepository } from 'typeorm';

import { generateCode } from '@core/utils/auth';

import GCPaymentService from '@core/services/GCPaymentService';

import JoinFlow, { JoinForm } from '@models/JoinFlow';
import Member from '@models/Member';
import RestartFlow from '@models/RestartFlow';

export interface CompletedJoinFlow {
    customerId: string,
    mandateId: string,
    joinForm: JoinForm
}

export default class JoinFlowService {
	static async createJoinFlow(completeUrl: string, joinForm: JoinForm, redirectFlowParams={}): Promise<string> {
		const sessionToken = generateCode();
		const redirectFlow = await GCPaymentService.createRedirectFlow(sessionToken, completeUrl, joinForm, redirectFlowParams);
		const joinFlow = new JoinFlow();
		joinFlow.redirectFlowId = redirectFlow.id;
		joinFlow.sessionToken = sessionToken;
		joinFlow.joinForm = joinForm;

		await getRepository(JoinFlow).save(joinFlow);

		return redirectFlow.redirect_url;
	}

	static async completeJoinFlow(redirectFlowId: string): Promise<CompletedJoinFlow|undefined> {
		const joinFlowRepository = getRepository(JoinFlow);
		const joinFlow = await joinFlowRepository.findOne({redirectFlowId});

		if (joinFlow) {
			const redirectFlow = await GCPaymentService.completeRedirectFlow(joinFlow.redirectFlowId, joinFlow.sessionToken);
			await joinFlowRepository.delete(joinFlow.id);

			return {
				customerId: redirectFlow.links.customer,
				mandateId: redirectFlow.links.mandate,
				joinForm: joinFlow.joinForm
			};
		}
	}

	static async createRestartFlow(member: Member, completedJoinFlow: CompletedJoinFlow): Promise<RestartFlow> {
		const restartFlow = new RestartFlow();
		restartFlow.member = member;
		restartFlow.customerId = completedJoinFlow.customerId;
		restartFlow.mandateId = completedJoinFlow.mandateId;
		restartFlow.joinForm = completedJoinFlow.joinForm;

		await getRepository(RestartFlow).save(restartFlow);

		return restartFlow;
	}

	static async completeRestartFlow(restartFlowId: string): Promise<RestartFlow|undefined> {
		const restartFlowRepository = getRepository(RestartFlow);
		const restartFlow = await restartFlowRepository.findOne({
			where: {id: restartFlowId},
			relations: ['member']
		});
		if (restartFlow) {
			await restartFlowRepository.delete(restartFlow.id);
			return restartFlow;
		}
	}
}
