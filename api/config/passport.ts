import { PassportStatic } from 'passport'
import { Strategy, ExtractJwt, StrategyOptions } from 'passport-jwt'
import { users } from '../models'

const configure = (passport: PassportStatic): void => {
  const { tokenSecret } = process.env

  const options: StrategyOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: tokenSecret
  }

  passport.use(new Strategy(options, async (jwtPayload, done) => {
    let user
    try { user = await users.getById(jwtPayload.id) }
    catch (error) {
      console.log(error)
      return done(error, undefined)
    }

    if (!user) { return done(null, false) }
    return done(null, user)
  }))
}

export default configure
