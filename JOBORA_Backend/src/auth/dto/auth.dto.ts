import { IsEmail, IsOptional, IsString, Length, MaxLength } from "class-validator"

export class LoginDto {
  @IsEmail()
  email!: string

  @IsString()
  @Length(8, 128)
  password!: string
}

export class RegisterDto extends LoginDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string
}
