import "reflect-metadata"
import { plainToInstance } from "class-transformer"
import { validate } from "class-validator"
import { CreateJobDto, CreateMatchDto, SaveProfileDto, SelectCvDto } from "./job-matcher.dto"

async function errorsFor<T extends object>(type: new () => T, payload: Record<string, unknown>) {
  return validate(plainToInstance(type, payload), { whitelist: true, forbidNonWhitelisted: true })
}

const validJob = {
  title: "Développeur Backend",
  description: "Nous recherchons un développeur backend pour construire des API.",
}

describe("job-matcher DTOs", () => {
  it("accepts a valid pasted job description", async () => {
    expect(await errorsFor(CreateJobDto, validJob)).toHaveLength(0)
    expect(await errorsFor(CreateJobDto, {
      ...validJob,
      requiredSkills: ["TypeScript"],
      minExperienceYears: 2,
      seniority: "junior",
      workArrangement: "hybrid",
    })).toHaveLength(0)
  })

  it("rejects a too short description and unknown enums", async () => {
    expect((await errorsFor(CreateJobDto, { ...validJob, description: "trop court" })).length).toBeGreaterThan(0)
    expect((await errorsFor(CreateJobDto, { ...validJob, seniority: "expert" })).length).toBeGreaterThan(0)
    expect((await errorsFor(CreateJobDto, { ...validJob, workArrangement: "everywhere" })).length).toBeGreaterThan(0)
    expect((await errorsFor(CreateJobDto, { ...validJob, title: "" })).length).toBeGreaterThan(0)
  })

  it("strips unknown fields and rejects them when forbidNonWhitelisted is on", async () => {
    const plain = plainToInstance(CreateJobDto, { ...validJob, isDemo: true })
    const errors = await validate(plain, { whitelist: true, forbidNonWhitelisted: true })
    expect(errors.some((error) => error.property === "isDemo")).toBe(true)
  })

  it("requires a CV id for profile extraction and matching", async () => {
    expect((await errorsFor(SelectCvDto, {})).length).toBeGreaterThan(0)
    expect((await errorsFor(CreateMatchDto, { jobIds: ["demo-backend-node"] })).length).toBeGreaterThan(0)
  })

  it("validates nested profile corrections and topN bounds", async () => {
    const valid = {
      cvId: "cv-1",
      topN: 10,
      profile: { skills: ["TypeScript"], experienceYears: 2, seniority: "junior" },
    }
    expect(await errorsFor(CreateMatchDto, valid)).toHaveLength(0)
    expect((await errorsFor(CreateMatchDto, { ...valid, topN: 0 })).length).toBeGreaterThan(0)
    expect((await errorsFor(CreateMatchDto, {
      ...valid,
      profile: { skills: "TypeScript" },
    })).length).toBeGreaterThan(0)
    expect((await errorsFor(CreateMatchDto, {
      ...valid,
      profile: { experienceYears: 90 },
    })).length).toBeGreaterThan(0)
  })

  it("requires the profile wrapper when saving corrections", async () => {
    expect((await errorsFor(SaveProfileDto, { skills: ["TypeScript"] })).length).toBeGreaterThan(0)
    expect(await errorsFor(SaveProfileDto, { profile: { skills: ["TypeScript"] } })).toHaveLength(0)
  })
})
