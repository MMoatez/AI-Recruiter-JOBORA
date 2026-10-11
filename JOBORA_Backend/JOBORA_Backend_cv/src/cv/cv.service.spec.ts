import { NotFoundException } from "@nestjs/common"
import { CvService } from "./cv.service"

describe("CvService ownership", () => {
  it("always scopes reads to the authenticated user", async () => {
    const lean = jest.fn().mockResolvedValue({ id: "cv_1", userId: "user_1" })
    const findOne = jest.fn().mockReturnValue({ lean })
    const service = new CvService({ findOne } as never, {} as never, {} as never)
    await service.get("user_1", "cv_1")
    expect(findOne).toHaveBeenCalledWith({ id: "cv_1", userId: "user_1" })
  })

  it("returns not found instead of exposing another user's CV", async () => {
    const findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) })
    const service = new CvService({ findOne } as never, {} as never, {} as never)
    await expect(service.get("user_2", "cv_1")).rejects.toBeInstanceOf(NotFoundException)
  })
})
