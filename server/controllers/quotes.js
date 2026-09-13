import * as service from "../services/quotes.js";

export async function list(req, res, next) {
  try {
    const quotes = await service.listQuotes(req.params.calcKey);
    res.json(quotes);
  } catch (err) {
    next(err);
  }
}

export async function count(req, res, next) {
  try {
    const value = await service.countQuotes(req.params.calcKey);
    res.json({ count: value });
  } catch (err) {
    next(err);
  }
}

export async function nextId(req, res, next) {
  try {
    const quoteId = await service.getNextQuoteId(req.params.calcKey);
    res.json({ quoteId });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const quote = await service.createQuote(req.params.calcKey, req.body);
    res.status(201).json(quote);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const ok = await service.deleteQuote(req.params.calcKey, req.params.id);
    if (!ok) {
      return res
        .status(404)
        .json({ error: `Quote ${req.params.id} not found` });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function customers(req, res, next) {
  try {
    const names = await service.getDistinctCustomers();
    res.json(names);
  } catch (err) {
    next(err);
  }
}
