export type PrepQuestion = {
	skill: string
	type: string
	question: string
	options: string[]
	correct_index: number | null
	expected_answer: string
	explanation: string
	difficulty: string
	source: string | null
	verified: boolean | null
}
export type PrepAnswer = {
	questionIndex: number
	userAnswer: string | null
	selectedIndex: number | null
	verdict: string
	score: number
	feedback: string
}
export type MockMessage = { role: "assistant" | "user"; content: string }
export type PrepSessionDocument = {
	id: string
	userId: string
	offerText: string
	offer: Record<string, unknown>
	cvText: string
	config: { type: string; count: number; level: string }
	status: string
	error: string | null
	questions: PrepQuestion[]
	answers: PrepAnswer[]
	weakSkills: string[]
	mockHistory: MockMessage[]
	createdAt: string
	updatedAt: string
	toObject(): PrepSessionDocument
	save(): Promise<PrepSessionDocument>
}

