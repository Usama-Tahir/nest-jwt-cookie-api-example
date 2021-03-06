import * as bcrypt from 'bcryptjs';

import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';

import { SignupDto } from './dto/signup.dto';
import { UserEntity } from '../user/user.entity';
import { TokenDto } from './dto/token.dto';
import { LoginDto } from './dto/login.dto';
import { UpdatePasswordDto } from './dto/updatePassword.dto';

import { QueryFailedError } from 'typeorm';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {}

  public async signup(signup: SignupDto): Promise<UserEntity> {
    const user = {
      username: signup.username,
      password: await this.hashPassword(signup.password),
    } as UserEntity;
    return await this.userService.create(user);
  }

  public async login(credentials: LoginDto): Promise<UserEntity> {
    let user = null;
    try {
      user = await this.userService.findOneOrFail({
        username: credentials.username,
      });
    } catch (e) {
      throw new NotFoundException(`No user was found.`);
    }

    if (await this.checkPassword(credentials.password, user.password)) {
      return user;
    }

    // no use hiding usernames since they are public
    throw new BadRequestException(`Wrong password.`);
  }

  public async changePassword(
    id: string,
    data: UpdatePasswordDto,
  ): Promise<null> {
    // get the password from the database
    // bcrypt makes salt each time
    const user = await this.userService.findOneOrFail({ id });
    const oldPasswordHash = user.password;
    if (!(await this.checkPassword(data.oldpassword, user.password))) {
      throw new BadRequestException('Old password is wrong.');
    }

    const newPasswordHash = await this.hashPassword(data.newpassword);
    try {
      // todo, update does not give us a usable result
      // but keeping it since this update is atomic
      await this.userService.update(
        { id, password: oldPasswordHash },
        { password: newPasswordHash },
      );
      return;
    } catch (error) {
      // todo, the user might not exist anymore
      throw new BadRequestException(`Password could not be updated.`);
    }
  }

  public createToken(user: UserEntity): string {
    const token = {
      id: user.id,
    } as TokenDto;
    return this.jwtService.sign(token);
  }

  public async checkPassword(pass, hash): Promise<boolean> {
    return bcrypt.compare(pass, hash);
  }

  public async hashPassword(pass): Promise<string> {
    return bcrypt.hash(pass, 10);
  }
}
