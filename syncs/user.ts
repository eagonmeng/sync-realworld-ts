import { actions, Frames, Vars } from "../engine/mod.ts";
import { API, JWT, Password, Profile, User } from "./context.ts";
import {
  projectFromObject as _projectFromObject,
  requireBound,
  withUuid,
} from "./helpers.ts";
import { withUserResponse } from "./response.ts";

// ===== USER REGISTRATION FLOW =====

const UserRegistration = (
  { request, username, email, password, user }: Vars,
) => ({
  when: actions(
    [API.request, { action: "user_registration", username, email, password }, {
      request,
    }],
  ),
  where: (frames: Frames): Frames => {
    return withUuid(frames, user);
  },
  then: actions(
    [User.register, { user, name: username, email }],
  ),
});

const PasswordSetError = ({ request, error, response }: Vars) => ({
  when: actions(
    [API.request, { action: "user_registration" }, { request }],
    [Password.set, {}, { error }],
  ),
  where: (frames: Frames): Frames => {
    return frames.map(($) => ({
      ...$,
      [response]: {
        status: 422,
        body: { errors: { body: [$[error] as unknown] } },
      },
    }));
  },
  then: actions(
    [API.response, { request, output: response }],
  ),
});

const UserRegistrationError = ({ request, error, response }: Vars) => ({
  when: actions(
    [API.request, { action: "user_registration" }, { request }],
    [User.register, {}, { error }],
  ),
  where: (frames: Frames): Frames => {
    return frames.map(($) => ({
      ...$,
      [response]: {
        status: 422,
        body: { errors: { body: [$[error] as unknown] } },
      },
    }));
  },
  then: actions(
    [API.response, { request, output: response }],
  ),
});

const SetNewPassword = ({ password, user }: Vars) => ({
  when: actions(
    [API.request, { action: "user_registration", password }, {}],
    [User.register, {}, { user }],
  ),
  then: actions(
    [Password.set, { user, password }],
  ),
});

const CreateDefaultProfile = ({ user, profile }: Vars) => ({
  when: actions(
    [User.register, {}, { user }],
  ),
  where: (frames: Frames): Frames => withUuid(frames, profile),
  then: actions(
    [Profile.register, { profile, user }],
  ),
});

const CreateNewUserToken = ({ user }: Vars) => ({
  when: actions(
    [User.register, {}, { user }],
  ),
  then: actions(
    [JWT.generate, { user }],
  ),
});

const FormatRegistrationResponse = (
  { request, user, token, username, email, response }: Vars,
) => ({
  when: actions(
    [API.request, { action: "user_registration", username, email }, {
      request,
    }],
    [User.register, {}, { user }],
    [Profile.register, { user }, {}],
    [Password.set, { user }, {}],
    [JWT.generate, { user }, { token }],
  ),
  where: (frames: Frames): Frames => {
    return withUserResponse(frames, response, { email, token, username });
  },
  then: actions(
    [API.response, { request, output: response }],
  ),
});

// ===== USER LOGIN FLOW =====

const AuthenticateUser = ({ email, password, user }: Vars) => ({
  when: actions(
    [API.request, { action: "user_login", email, password }, {}],
  ),
  where: async (frames: Frames): Promise<Frames> => {
    return await frames.query(User._getByEmail, { email }, { user });
  },
  then: actions(
    [Password.check, { user, password }],
  ),
});

const GenerateLoginToken = ({ user }: Vars) => ({
  when: actions(
    [Password.check, { user }, { valid: true }],
  ),
  then: actions(
    [JWT.generate, { user }],
  ),
});

const LoginAuthenticationError = ({ request, response }: Vars) => ({
  when: actions(
    [API.request, { action: "user_login" }, { request }],
    [Password.check, {}, { valid: false }],
  ),
  where: (frames: Frames): Frames => {
    return frames.map(($) => ({
      ...$,
      [response]: {
        status: 422,
        body: { errors: { body: ["Invalid email or password"] } },
      },
    }));
  },
  then: actions(
    [API.response, { request, output: response }],
  ),
});

const FormatLoginResponse = (
  { request, user, token, email, username, response }: Vars,
) => ({
  when: actions(
    [API.request, { action: "user_login", email }, { request }],
    [Password.check, { user }, { valid: true }],
    [JWT.generate, { user }, { token }],
  ),
  where: async (frames: Frames): Promise<Frames> => {
    const withUser = await frames.query(User._get, { user }, {
      name: username,
    });
    return withUserResponse(withUser, response, {
      email,
      token,
      username,
    });
  },
  then: actions(
    [API.response, { request, output: response }],
  ),
});

// ===== CURRENT USER & UPDATE =====

const GetCurrentUser = (
  { request, token, user, email, username, bio, image, response }: Vars,
) => ({
  when: actions(
    [API.request, { method: "GET", path: "/api/user" }, { request }],
  ),
  where: async (frames: Frames): Promise<Frames> => {
    const tokenFrames = await frames.query(API._get, { request }, { token });
    const userFrames = await tokenFrames.query(JWT._getUser, { token }, {
      user,
    });
    const userDataFrames = await userFrames.query(User._get, { user }, {
      name: username,
      email,
    });
    const profileFrames = await userDataFrames.query(Profile._getByUser, {
      user,
    }, {
      bio,
      image,
    });
    return withUserResponse(profileFrames, response, {
      email,
      token,
      username,
      bio,
      image,
    });
  },
  then: actions([API.response, { request, output: response }]),
});

const UpdateUser = ({ request, token }: Vars) => ({
  when: actions(
    [API.request, { method: "PUT", path: "/api/user" }, { request }],
  ),
  where: async (frames: Frames): Promise<Frames> => {
    return await frames.query(API._get, { request }, { token });
  },
  then: actions([JWT.verify, { token }]),
});

const UpdateUserFinalize = (
  {
    request,
    token,
    user,
    email,
    username,
    bio,
    image,
    newEmail,
    newUsername,
    newPassword: _newPassword,
    newBio,
    newImage,
    response,
    finalEmail,
    finalUsername,
    finalBio,
    finalImage,
  }: Vars,
) => ({
  when: actions(
    [API.request, { method: "PUT", path: "/api/user" }, { request }],
    [JWT.verify, { token }, { user }],
  ),
  where: async (frames: Frames): Promise<Frames> => {
    const reqFrames = await frames.query(API._get, { request }, {
      newEmail,
      newUsername,
      newBio,
      newImage,
    });
    const withUser = await reqFrames.query(User._get, { user }, {
      name: username,
      email,
    });
    const withProfile = await withUser.query(Profile._getByUser, { user }, {
      bio,
      image,
    });
    const withFinals = withProfile.map(($) => ({
      ...$,
      [finalEmail]: $[newEmail] !== undefined ? $[newEmail] : $[email],
      [finalUsername]: $[newUsername] !== undefined
        ? $[newUsername]
        : $[username],
      [finalBio]: $[newBio] !== undefined ? $[newBio] : $[bio],
      [finalImage]: $[newImage] !== undefined ? $[newImage] : $[image],
    }));
    return withUserResponse(withFinals, response, {
      email: finalEmail,
      token,
      username: finalUsername,
      bio: finalBio,
      image: finalImage,
    });
  },
  then: actions(
    [User.update, { user, name: finalUsername, email: finalEmail }],
    [Profile.update, { user, bio: finalBio, image: finalImage }],
    [API.response, { request, output: response }],
  ),
});

const UpdateUserPassword = (
  { request, token, user, newPassword }: Vars,
) => ({
  when: actions(
    [API.request, { method: "PUT", path: "/api/user" }, { request }],
    [JWT.verify, { token }, { user }],
  ),
  where: async (frames: Frames): Promise<Frames> => {
    const withPwd = await frames.query(API._get, { request }, { newPassword });
    return requireBound(withPwd, newPassword);
  },
  then: actions([Password.set, { user, password: newPassword }]),
});

export const userSyncs = {
  // Registration
  UserRegistration,
  UserRegistrationError,
  SetNewPassword,
  PasswordSetError,
  CreateDefaultProfile,
  CreateNewUserToken,
  FormatRegistrationResponse,
  // Login
  AuthenticateUser,
  GenerateLoginToken,
  LoginAuthenticationError,
  FormatLoginResponse,
  // Current user + update
  GetCurrentUser,
  UpdateUser,
  UpdateUserFinalize,
  UpdateUserPassword,
};
