import { PassportStatic } from 'passport'
import { Strategy, ExtractJwt, StrategyOptions } from 'passport-jwt'
import { users } from '../models'

const configure = (passport: PassportStatic): void => {
  const options: StrategyOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.tokenSecret || 'secret_j91jasf0j1asfkl' // Change this to only use your own secret token
  }

  passport.use(new Strategy(options, async (jwtPayload, done) => {
    let user
    try { user = await users.getById(jwtPayload.id) }
    catch (error) {
      console.log(error)
      return done(error, null)
    }

    if (!user) { return done(null, false) }
    return done(null, user)
  }))
}

export default configure
