import { ParamValue } from '@core/utils/params';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type ExportTypeId = 'active-members';//'active-members'|'edition'|'gocardless'

@Entity()
export default class Export {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column()
	type!: ExportTypeId

	@Column({type: 'text'})
	description!: string

	@CreateDateColumn()
	date!: Date

	@Column({type: 'jsonb', nullable: true})
	params!: Record<string, ParamValue>|null
}
