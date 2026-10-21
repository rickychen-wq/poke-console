import test from 'node:test';
import assert from 'node:assert/strict';
import {installMultipliers} from '../js/safari-core.js';
const settings={account:'chen0414',damage:10,speed:5,defense:10};
function fixture(){
  class Player {
    constructor(dex=150){this.dex=dex;this.baseAtk=1.55;this.atkMul=1.4;this.baseSpd=164.92;this.reduce=0.16;}
    get atk(){return this.baseAtk*this.atkMul;}
    get spd(){return this.baseSpd;}
    get reduction(){return Math.min(0.8,this.reduce);}
  }
  const game={Player,DB:{save:{name:'chen0414',coins:20000000,tickets:{t1:132,t10:119}}},Game:{player:new Player()}};
  return game;
}
test('requested multipliers apply; tenfold defense means one tenth incoming damage',()=>{
  const game=fixture(),save=JSON.stringify(game.DB.save),result=installMultipliers(game,settings);
  assert.equal(result.current.attack,21.7);
  assert.ok(Math.abs(result.current.speed-824.6)<1e-8);
  assert.ok(Math.abs((1-result.current.reduction)/(1-0.16)-0.1)<1e-8);
  assert.equal(JSON.stringify(game.DB.save),save);
});
test('reapplying never stacks and a new run receives the same boost',()=>{
  const game=fixture();installMultipliers(game,settings);installMultipliers(game,settings);
  assert.equal(game.Game.player.atk,21.7);
  game.Game.player=new game.Player();assert.equal(game.Game.player.atk,21.7);
  assert.ok(Math.abs(game.Game.player.spd-824.6)<1e-8);
});
test('other Pokemon, co-op players and accounts keep original values',()=>{
  const game=fixture();installMultipliers(game,settings);
  const teammate=new game.Player();assert.equal(teammate.atk,2.17);
  game.Game.player=new game.Player(25);assert.equal(game.Game.player.atk,2.17);
  game.Game.player=new game.Player();game.DB.save.name='chen414';assert.equal(game.Game.player.atk,2.17);
});
test('disabling restores ordinary values without changing the save',()=>{
  const game=fixture();installMultipliers(game,settings);installMultipliers(game,{...settings,enabled:false});
  assert.equal(game.Game.player.atk,2.17);assert.equal(game.Game.player.spd,164.92);assert.equal(game.Game.player.reduction,0.16);
});
test('previous one-run experiment is removed instead of producing a 100x boost',()=>{
  const game=fixture(),p=game.Game.player,key=Symbol.for('poke.console.mewtwo.atk10.original');
  Object.defineProperty(p,key,{value:{multiplier:1.4,attack:2.17},configurable:true});p.atkMul=14;
  installMultipliers(game,settings);assert.equal(p.atk,21.7);assert.equal(p.atkMul,1.4);assert.equal(p[key],undefined);
});
test('unsupported player interfaces stop before changing any getter',()=>{
  const game=fixture(),original=Object.getOwnPropertyDescriptor(game.Player.prototype,'atk');
  delete game.Player.prototype.reduction;
  assert.throws(()=>installMultipliers(game,settings),/不相容/);
  assert.equal(Object.getOwnPropertyDescriptor(game.Player.prototype,'atk').get,original.get);
});

