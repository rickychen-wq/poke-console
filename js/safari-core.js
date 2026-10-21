export function installMultipliers(game, options) {
  const settings = {
    account: options?.account,
    damage: options?.damage,
    speed: options?.speed,
    defense: options?.defense,
    enabled: options?.enabled !== false,
  };
  if (settings.account !== 'chen0414' || [settings.damage,settings.speed,settings.defense].some(n => !Number.isFinite(n) || n < 1 || n > 1000)) {
    throw new Error('倍率或目標帳號設定不符。');
  }
  if (!game?.Player?.prototype || !game.Game || !game.DB) throw new Error('遊戲尚未就緒。');
  const prototype = game.Player.prototype;
  const marker = Symbol.for('chen.pokesurvivor.mewtwo.multipliers.v1');
  let record = Object.prototype.hasOwnProperty.call(prototype,marker) ? prototype[marker] : null;
  if (!record) {
    const originals = Object.fromEntries(['atk','spd','reduction'].map(key => {
      const descriptor = Object.getOwnPropertyDescriptor(prototype,key);
      if (typeof descriptor?.get !== 'function' || !descriptor.configurable) throw new Error('此版本能力介面不相容：'+key);
      return [key,descriptor];
    }));
    record = {settings,originals};
    for (const key of ['atk','spd','reduction']) {
      const descriptor = originals[key];
      Object.defineProperty(prototype,key,{
        ...descriptor,
        get: function () {
          const original = descriptor.get.call(this);
          const config = record.settings;
          if (!config.enabled || game.DB.save?.name !== config.account || this.dex !== 150 || game.Game.player !== this) return original;
          if (key === 'atk') return original * config.damage;
          if (key === 'spd') return original * config.speed;
          return 1 - (1 - original) / config.defense;
        },
      });
    }
    Object.defineProperty(prototype,marker,{value:record,configurable:true});
  } else {
    record.settings = settings;
  }
  // Remove the earlier one-run test before applying the automatic getter.
  const player = game.Game.player;
  const oneRun = Symbol.for('poke.console.mewtwo.atk10.original');
  if (game.DB.save?.name === settings.account && player?.dex === 150 && player[oneRun]) {
    if (!Number.isFinite(player.atkMul) || player.atkMul <= 0) throw new Error('舊測試倍率異常。');
    player.atkMul /= 10;
    delete player[oneRun];
  }
  const matching = game.DB.save?.name === settings.account && player?.dex === 150;
  return {
    ok:true,enabled:settings.enabled,account:settings.account,
    damage:settings.damage,speed:settings.speed,defense:settings.defense,
    currentPlayerMatches:matching,
    current:matching?{attack:player.atk,speed:player.spd,reduction:player.reduction}:null,
  };
}
